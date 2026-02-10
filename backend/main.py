"""
FastAPI Backend - Radar de Preço & CMV
Main application with REST API endpoints.
"""

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Import tools
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from tools.ocr_processor import ocr_from_bytes
from tools.receipt_parser import parse_receipt
from tools.cmv_calculator import recalculate_affected_recipes, calculate_cmv_change_percentage
from tools.discord_notifier import send_price_alert, send_cmv_update
from backend.utils.logger import logger

load_dotenv()

# Supabase client (using service_role for backend operations)
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    SUPABASE_SERVICE_KEY
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("[STARTUP] Backend started - Radar de Preco & CMV")
    yield
    logger.info("[SHUTDOWN] Backend shutting down")


app = FastAPI(
    title="Radar de Preço & CMV API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= Pydantic Models =============

class ReceiptItemResponse(BaseModel):
    id: str
    raw_name: str
    parsed_price: Optional[Decimal]
    quantity: Decimal
    matched_ingredient_id: Optional[str] = None
    suggested_ingredient: Optional[dict] = None


class UploadReceiptResponse(BaseModel):
    receipt_id: str
    market_name: Optional[str]
    total_amount: Optional[Decimal]
    items: List[ReceiptItemResponse]


class ValidateItemInput(BaseModel):
    receipt_item_id: str
    ingredient_id: str
    price: Decimal


class ValidateReceiptInput(BaseModel):
    receipt_id: str
    items: List[ValidateItemInput]


# ============= Endpoints =============

@app.get("/api/health")
def health_check():
    """Health check for Docker/Uptime monitors."""
    try:
        # Simple query to check DB connection
        supabase.table("ingredients").select("id").limit(1).execute()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(503, f"Service unhealthy: {str(e)}")


@app.get("/")
def read_root():
    return {"status": "online", "service": "Radar de Preço & CMV"}


@app.post("/api/receipts/upload", response_model=UploadReceiptResponse)
async def upload_receipt(file: UploadFile = File(...)):
    """
    Upload receipt image, perform OCR, and stage for validation.
    
    Flow:
    1. Read image bytes
    2. OCR extraction
    3. Parse text to structured data
    4. Fuzzy match against product_map
    5. Save to database (pending_validation)
    """
    request_id = str(uuid.uuid4())
    logger.info(f"Starting receipt upload processing", extra={"request_id": request_id, "file_name": file.filename})
    
    try:
        # Read image
        contents = await file.read()
        
        # OCR
        text = ocr_from_bytes(contents)
        logger.debug(f"OCR Output", extra={"request_id": request_id, "text_length": len(text), "preview": text[:100]})
        
        if not text or len(text) < 20:
            logger.warning("OCR failed to extract sufficient text", extra={"request_id": request_id})
            raise HTTPException(400, "OCR failed - no text detected")
        
        # Parse receipt
        parsed = parse_receipt(text)
        logger.info("Receipt parsed successfully", extra={"request_id": request_id, "market": parsed.get("market_name")})
        
        # Create receipt record
        receipt_data = {
            "market_name": parsed["market_name"],
            "total_amount": float(parsed["total_amount"]) if parsed["total_amount"] else None,
            "status": "pending_validation"
        }
        
        receipt_response = supabase.table("receipts").insert(receipt_data).execute()
        receipt_id = receipt_response.data[0]["id"]
        
        # Stage items
        response_items = []
        for item in parsed["items"]:
            # Try to find match in product_map
            matched_ingredient = None
            product_map_response = supabase.table("product_map") \
                .select("ingredient_id, ingredients(id, name, category)") \
                .ilike("raw_name", f"%{item['raw_name'][:20]}%") \
                .limit(1) \
                .execute()
            
            if product_map_response.data:
                ingredient_data = product_map_response.data[0]["ingredients"]
                matched_ingredient = {
                    "id": ingredient_data["id"],
                    "name": ingredient_data["name"],
                    "category": ingredient_data["category"]
                }
            
            # Insert item
            item_data = {
                "receipt_id": receipt_id,
                "raw_name": item["raw_name"],
                "parsed_price": float(item["price"]),
                "quantity": float(item["quantity"]),
                "matched_ingredient_id": matched_ingredient["id"] if matched_ingredient else None
            }
            
            item_response = supabase.table("receipt_items").insert(item_data).execute()
            item_record = item_response.data[0]
            
            response_items.append(ReceiptItemResponse(
                id=item_record["id"],
                raw_name=item_record["raw_name"],
                parsed_price=Decimal(str(item_record["parsed_price"])),
                quantity=Decimal(str(item_record["quantity"])),
                matched_ingredient_id=item_record["matched_ingredient_id"],
                suggested_ingredient=matched_ingredient
            ))
        
        logger.info(f"Receipt uploaded successfully", extra={"request_id": request_id, "receipt_id": receipt_id, "items_count": len(response_items)})
        
        return UploadReceiptResponse(
            receipt_id=receipt_id,
            market_name=parsed["market_name"],
            total_amount=parsed["total_amount"],
            items=response_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}", extra={"request_id": request_id}, exc_info=True)
        raise HTTPException(500, f"Upload failed: {str(e)}")


@app.put("/api/receipts/{receipt_id}/validate")
async def validate_receipt(receipt_id: str, payload: ValidateReceiptInput):
    """
    Validate receipt and update ingredient prices.
    
    Flow:
    1. Update product_map (learning)
    2. Update ingredient prices
    3. Recalculate affected recipes
    4. Send Discord alerts if needed
    5. Mark receipt as verified
    """
    request_id = str(uuid.uuid4())
    logger.info(f"Starting receipt validation", extra={"request_id": request_id, "receipt_id": receipt_id, "items_count": len(payload.items)})
    
    try:
        updated_ingredients = []
        ingredient_ids = []
        
        for item in payload.items:
            # Get receipt item
            receipt_item = supabase.table("receipt_items") \
                .select("*") \
                .eq("id", item.receipt_item_id) \
                .single() \
                .execute()
            
            if not receipt_item.data:
                logger.warning(f"Receipt item not found", extra={"request_id": request_id, "item_id": item.receipt_item_id})
                continue
            
            # Update product_map (learning) - upsert to avoid duplicates
            supabase.table("product_map").upsert({
                "raw_name": receipt_item.data["raw_name"],
                "ingredient_id": item.ingredient_id,
                "confidence": 1.0
            }, on_conflict="raw_name,ingredient_id").execute()
            
            # Get current price before update
            ingredient = supabase.table("ingredients") \
                .select("*") \
                .eq("id", item.ingredient_id) \
                .single() \
                .execute()
            
            old_price = Decimal(str(ingredient.data["current_price"]))
            new_price = item.price
            
            # Update ingredient price (category is preserved)
            supabase.table("ingredients").update({
                "current_price": float(new_price),
                "last_updated": datetime.utcnow().isoformat()
            }).eq("id", item.ingredient_id).execute()
            
            updated_ingredients.append({
                "name": ingredient.data["name"],
                "old_price": old_price,
                "new_price": new_price
            })
            ingredient_ids.append(item.ingredient_id)
            
            # Check if price change warrants alert
            if old_price > 0:
                change_pct = calculate_cmv_change_percentage(old_price, new_price)
                if abs(change_pct) >= 10:
                    send_price_alert(
                        ingredient.data["name"],
                        old_price,
                        new_price,
                        change_pct
                    )
                    logger.info("Price alert sent", extra={"request_id": request_id, "ingredient": ingredient.data["name"], "change_pct": change_pct})
        
        # Recalculate affected recipes
        affected_recipes = await recalculate_affected_recipes(ingredient_ids, supabase)
        logger.info(f"Recipes recalculated", extra={"request_id": request_id, "count": len(affected_recipes)})
        
        # Mark receipt as verified
        supabase.table("receipts").update({
            "status": "verified"
        }).eq("id", receipt_id).execute()
        
        logger.info("Receipt validation completed", extra={"request_id": request_id, "receipt_id": receipt_id})
        
        return {
            "success": True,
            "updated_ingredients": len(updated_ingredients),
            "recalculated_recipes": len(affected_recipes),
            "affected_recipes": [r["recipe_id"] for r in affected_recipes]
        }
        
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}", extra={"request_id": request_id}, exc_info=True)
        raise HTTPException(500, f"Validation failed: {str(e)}")


@app.get("/api/receipts/pending")
def get_pending_receipts():
    """Get all receipts waiting for validation."""
    logger.debug("Fetching pending receipts")
    response = supabase.table("receipts") \
        .select("*, receipt_items(*)") \
        .eq("status", "pending_validation") \
        .order("created_at", desc=True) \
        .execute()
    
    return response.data


@app.get("/api/ingredients")
def list_ingredients(search: Optional[str] = None):
    """List all ingredients with optional search."""
    logger.debug(f"Listing ingredients", extra={"search": search})
    query = supabase.table("ingredients").select("*")
    
    if search:
        query = query.ilike("name", f"%{search}%")
    
    response = query.order("name").execute()
    return response.data


@app.get("/api/ingredients/pending")
def list_pending_ingredients():
    """List ingredients with missing data (category or unit)."""
    logger.debug("Fetching pending ingredients")
    response = supabase.table("ingredients") \
        .select("*") \
        .or_("category.is.null,category.eq.,unit.is.null,unit.eq.") \
        .order("name") \
        .execute()
    return response.data


class CreateIngredientInput(BaseModel):
    name: str
    category: Optional[str] = None
    current_price: Optional[float] = 0
    unit: Optional[str] = None


class UpdateIngredientInput(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    current_price: Optional[float] = None
    unit: Optional[str] = None


@app.post("/api/ingredients")
def create_ingredient(payload: CreateIngredientInput):
    """Create a new ingredient."""
    logger.info(f"Creating ingredient: {payload.name}")
    
    try:
        data = {
            "name": payload.name.strip(),
            "category": payload.category,
            "current_price": payload.current_price or 0,
            "unit": payload.unit
        }
        response = supabase.table("ingredients").insert(data).execute()
        return response.data[0]
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(400, "Ingredient already exists")
        logger.error(f"Failed to create ingredient: {e}")
        raise HTTPException(500, f"Failed to create ingredient: {str(e)}")


@app.put("/api/ingredients/{ingredient_id}")
def update_ingredient(ingredient_id: str, payload: UpdateIngredientInput):
    """Update an existing ingredient."""
    logger.info(f"Updating ingredient: {ingredient_id}")
    
    try:
        update_data = {}
        if payload.name is not None:
            update_data["name"] = payload.name.strip()
        if payload.category is not None:
            update_data["category"] = payload.category
        if payload.current_price is not None:
            update_data["current_price"] = payload.current_price
        if payload.unit is not None:
            update_data["unit"] = payload.unit
        
        if not update_data:
            raise HTTPException(400, "No fields to update")
        
        response = supabase.table("ingredients") \
            .update(update_data) \
            .eq("id", ingredient_id) \
            .execute()
        
        if not response.data:
            raise HTTPException(404, "Ingredient not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update ingredient: {e}")
        raise HTTPException(500, f"Failed to update ingredient: {str(e)}")


@app.get("/api/categories")
def list_categories(search: Optional[str] = None):
    """List all ingredient categories with optional search."""
    logger.debug(f"Listing categories", extra={"search": search})
    query = supabase.table("ingredients_categories").select("*")
    
    if search:
        query = query.ilike("name", f"%{search}%")
    
    response = query.order("name").execute()
    return response.data


class CreateCategoryInput(BaseModel):
    name: str


@app.post("/api/categories")
def create_category(payload: CreateCategoryInput):
    """Create a new ingredient category."""
    logger.info(f"Creating category: {payload.name}")
    
    try:
        response = supabase.table("ingredients_categories").insert({
            "name": payload.name.strip().lower()
        }).execute()
        
        return response.data[0]
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(400, "Category already exists")
        logger.error(f"Failed to create category: {e}")
        raise HTTPException(500, f"Failed to create category: {str(e)}")



# ============= Recipe Models =============

class RecipeIngredientInput(BaseModel):
    ingredient_id: str
    quantity: float  # In KG/L/UN


class RecipeInput(BaseModel):
    name: str
    yield_units: int
    total_weight_kg: Optional[float] = None
    labor_cost: float = 0.0
    sku: Optional[str] = None
    ingredients: List[RecipeIngredientInput]



# ============= Recipe Logic =============

def calculate_recipe_totals(yield_units: int, ingredients: List[dict], labor_cost: Decimal) -> dict:
    """Calculate total cost and CMV metrics."""
    total_cost = labor_cost
    total_weight = Decimal("0.00")
    
    for item in ingredients:
        qty = Decimal(str(item["quantity"]))
        price = Decimal(str(item.get("current_price", 0)))
        total_cost += price * qty
        # For now assume ingredient quantity is in KG/L which maps 1:1 to weight
        # If unit is UN, weight might be different but we'll use qty as proxy for now
        total_weight += qty
        
    cmv_per_unit = total_cost / Decimal(yield_units) if yield_units > 0 else Decimal("0.00")
    cmv_per_kg = total_cost / total_weight if total_weight > 0 else Decimal("0.00")
    
    return {
        "current_cost": float(total_cost),
        "total_weight_kg": float(total_weight),
        "cmv_per_unit": float(cmv_per_unit),
        "cmv_per_kg": float(cmv_per_kg)
    }


@app.post("/api/recipes")
def create_recipe(payload: RecipeInput):
    """Create a new recipe with ingredients and labor cost."""
    logger.info(f"Creating recipe: {payload.name}")
    
    try:
        # 1. Fetch current prices for ingredients
        ing_ids = [i.ingredient_id for i in payload.ingredients]
        if ing_ids:
            ing_response = supabase.table("ingredients").select("id, current_price").in_("id", ing_ids).execute()
            price_map = {i["id"]: i["current_price"] for i in ing_response.data}
        else:
            price_map = {}
            
        # 2. Prepare ingredients list with prices for calculation
        calc_ingredients = []
        for item in payload.ingredients:
            calc_ingredients.append({
                "quantity": item.quantity,
                "current_price": price_map.get(item.ingredient_id, 0)
            })
            
        # 3. Calculate totals
        totals = calculate_recipe_totals(
            payload.yield_units, 
            calc_ingredients, 
            Decimal(str(payload.labor_cost))
        )
        
        # 4. Insert Recipe
        recipe_data = {
            "name": payload.name,
            "yield_units": payload.yield_units,
            "labor_cost": payload.labor_cost,
            "sku": payload.sku,
            "current_cost": totals["current_cost"],
            "total_weight_kg": totals["total_weight_kg"],
            "cmv_per_unit": totals["cmv_per_unit"],
            "cmv_per_kg": totals["cmv_per_kg"],
            "last_calculated": datetime.utcnow().isoformat()
        }
        
        res = supabase.table("recipes").insert(recipe_data).execute()
        recipe = res.data[0]
        
        # 5. Insert Recipe Ingredients
        if payload.ingredients:
            recipe_ingredients = [{
                "recipe_id": recipe["id"],
                "ingredient_id": i.ingredient_id,
                "quantity": i.quantity
            } for i in payload.ingredients]
            
            supabase.table("recipe_ingredients").insert(recipe_ingredients).execute()
            
        return recipe
        
    except Exception as e:
        logger.error(f"Failed to create recipe: {e}")
        raise HTTPException(500, f"Failed to create recipe: {str(e)}")


@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    """Get recipe details including ingredients."""
    try:
        # Fetch recipe
        recipe_res = supabase.table("recipes").select("*").eq("id", recipe_id).single().execute()
        if not recipe_res.data:
            raise HTTPException(404, "Recipe not found")
        
        # Fetch ingredients with details
        ing_res = supabase.table("recipe_ingredients") \
            .select("*, ingredients(name, unit, current_price, category)") \
            .eq("recipe_id", recipe_id) \
            .execute()
            
        recipe = recipe_res.data
        recipe["ingredients"] = ing_res.data
        
        return recipe
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recipe: {e}")
        raise HTTPException(500, f"Failed to get recipe: {str(e)}")


@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: str, payload: RecipeInput):
    """Update recipe details and ingredients."""
    logger.info(f"Updating recipe: {recipe_id}")
    
    try:
        # 1. Fetch current prices
        ing_ids = [i.ingredient_id for i in payload.ingredients]
        if ing_ids:
            ing_response = supabase.table("ingredients").select("id, current_price").in_("id", ing_ids).execute()
            price_map = {i["id"]: i["current_price"] for i in ing_response.data}
        else:
            price_map = {}
            
        # 2. Calculate totals
        calc_ingredients = []
        for item in payload.ingredients:
            calc_ingredients.append({
                "quantity": item.quantity,
                "current_price": price_map.get(item.ingredient_id, 0)
            })
            
        totals = calculate_recipe_totals(
            payload.yield_units, 
            calc_ingredients, 
            Decimal(str(payload.labor_cost))
        )
        
        # 3. Update Recipe
        recipe_data = {
            "name": payload.name,
            "yield_units": payload.yield_units,
            "labor_cost": payload.labor_cost,
            "sku": payload.sku,
            "current_cost": totals["current_cost"],
            "total_weight_kg": totals["total_weight_kg"],
            "cmv_per_unit": totals["cmv_per_unit"],
            "cmv_per_kg": totals["cmv_per_kg"],
            "last_calculated": datetime.utcnow().isoformat()
        }
        
        supabase.table("recipes").update(recipe_data).eq("id", recipe_id).execute()
        
        # 4. Update Ingredients (Delete all and re-insert)
        # Transaction would be better but Supabase-py doesn't support it easily yet
        supabase.table("recipe_ingredients").delete().eq("recipe_id", recipe_id).execute()
        
        if payload.ingredients:
            recipe_ingredients = [{
                "recipe_id": recipe_id,
                "ingredient_id": i.ingredient_id,
                "quantity": i.quantity
            } for i in payload.ingredients]
            
            supabase.table("recipe_ingredients").insert(recipe_ingredients).execute()
            
        return {"id": recipe_id, "status": "updated"}
        
    except Exception as e:
        logger.error(f"Failed to update recipe: {e}")
        raise HTTPException(500, f"Failed to update recipe: {str(e)}")


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    """Delete a recipe and its ingredients."""
    try:
        # Cascade delete handled by foreign key usually, but let's be safe
        supabase.table("recipe_ingredients").delete().eq("recipe_id", recipe_id).execute()
        supabase.table("recipes").delete().eq("id", recipe_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"Failed to delete recipe: {e}")
        raise HTTPException(500, f"Failed to delete recipe: {str(e)}")


@app.get("/api/recipes")
def list_recipes():
    """List all recipes with current CMV."""
    logger.debug("Fetching recipes")
    response = supabase.table("recipes") \
        .select("*") \
        .order("name") \
        .execute()
    
    return response.data



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
