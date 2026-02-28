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

class RecipeCategoryResponse(BaseModel):
    id: str
    name: str
    anvisa_portion_g: float
    created_at: datetime

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
    yield_coefficient: Optional[float] = 1.0
    unit: Optional[str] = None


class UpdateIngredientInput(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    category: Optional[str] = None
    current_price: Optional[float] = None
    yield_coefficient: Optional[float] = None
    unit: Optional[str] = None


@app.post("/api/ingredients")
def create_ingredient(payload: CreateIngredientInput):
    """Create a new ingredient."""
    logger.info(f"Creating ingredient: {payload.name}")
    
    try:
        data = {
            "name": payload.name.strip(),
            "category": payload.category,
            "category": payload.category,
            "current_price": payload.current_price or 0,
            "yield_coefficient": payload.yield_coefficient or 1.0,
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
        if payload.yield_coefficient is not None:
            update_data["yield_coefficient"] = payload.yield_coefficient
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


@app.get("/api/products")
def list_products(search: Optional[str] = None):
    """List products from Supabase products table with optional search."""
    logger.debug(f"Listing products", extra={"search": search})
    query = supabase.table("products").select("id, product, sku, status")
    
    if search:
        query = query.ilike("product", f"%{search}%")
        
    response = query.order("product").execute()
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



# ============= Recipe Categories Endpoints =============

@app.get("/api/recipe-categories", response_model=List[RecipeCategoryResponse])
def get_recipe_categories():
    """List all recipe categories and their portions."""
    try:
        res = supabase.table("recipe_categories").select("*").order("name").execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch recipe categories: {e}")
        raise HTTPException(500, f"Internal server error: {str(e)}")


# ============= Recipe Models =============

class RecipeIngredientInput(BaseModel):
    ingredient_id: str
    quantity: float  # In KG/L/UN


class RecipeInput(BaseModel):
    name: str
    yield_units: float
    total_weight_kg: Optional[float] = None
    labor_minutes: float = 0.0
    labor_cost: float = 0.0
    sku: Optional[str] = None
    category_id: Optional[str] = None
    product_id: Optional[int] = None
    is_pre_preparo: bool = False
    derived_ingredient_id: Optional[str] = None
    production_unit: Optional[str] = "KG"
    ingredients: List[RecipeIngredientInput]



# ============= Nutrition Constants =============

ANVISA_VD = {
    "energy_kcal": 2000,
    "carbs_g": 300,
    "protein_g": 50,
    "lipid_g": 65,
    "saturated_fat_g": 22,
    "fiber_g": 25,
    "sodium_mg": 2000
}


# ============= Recipe Logic =============

def calculate_recipe_totals(yield_units: float, ingredients: List[dict], labor_cost: Decimal) -> dict:
    """Calculate total cost and CMV metrics including breakdawn."""
    total_batch_ingredients_cost = Decimal("0.00")
    total_batch_packaging_cost = Decimal("0.00")
    total_weight = Decimal("0.00")
    
    for item in ingredients:
        qty = Decimal(str(item["quantity"]))
        price = Decimal(str(item.get("current_price", 0)))
        yield_coeff = Decimal(str(item.get("yield_coefficient", 1)))
        category = item.get("category", "")
        
        if yield_coeff > 0:
            effective_price = price / yield_coeff
        else:
            effective_price = price

        item_cost = effective_price * qty
        
        if category and 'EMBALAGEM' in category.upper():
            total_batch_packaging_cost += item_cost
        else:
            total_batch_ingredients_cost += item_cost
            total_weight += qty
            
    total_cost = total_batch_ingredients_cost + total_batch_packaging_cost + labor_cost
        
    cmv_per_unit = total_cost / Decimal(yield_units) if yield_units > 0 else Decimal("0.00")
    cmv_per_kg = total_cost / total_weight if total_weight > 0 else Decimal("0.00")
    
    return {
        "current_cost": float(total_cost),
        "ingredients_cost": float(total_batch_ingredients_cost),
        "packaging_cost": float(total_batch_packaging_cost),
        "total_weight_kg": float(total_weight),
        "cmv_per_unit": float(cmv_per_unit),
        "cmv_per_kg": float(cmv_per_kg)
    }

def materialize_pre_preparo_nutrition(recipe_name: str, calc_ingredients: List[dict], total_weight_kg: float, existing_ref_id: Optional[str] = None) -> Optional[str]:
    """Calculate and materialize nutrition for 100g of a pre-preparo recipe."""
    if total_weight_kg <= 0:
        return existing_ref_id
        
    total_energy_kcal = Decimal("0")
    total_energy_kj = Decimal("0")
    total_protein = Decimal("0")
    total_carbs = Decimal("0")
    total_lipid = Decimal("0")
    total_sat_fat = Decimal("0")
    total_trans_fat = Decimal("0")
    total_fiber = Decimal("0")
    total_sodium = Decimal("0")
    
    # We need to fetch the actual nutritional data for the refs.
    ref_ids = [item.get("nutritional_ref_id") for item in calc_ingredients if item.get("nutritional_ref_id")]
    if not ref_ids:
        return existing_ref_id # Cannot calculate if no ingredients have nutrition
        
    refs_response = supabase.table("nutritional_ref").select("*").in_("id", ref_ids).execute()
    refs_map = {r["id"]: r for r in refs_response.data}
    
    has_any_data = False
    
    for item in calc_ingredients:
        qty_kg = Decimal(str(item["quantity"]))
        qty_g = qty_kg * 1000
        ref_id = item.get("nutritional_ref_id")
        
        if not ref_id or ref_id not in refs_map:
            continue
            
        ref_data = refs_map[ref_id]
        base_qty = Decimal(str(ref_data.get("base_qty_g") or 100))
        if base_qty <= 0: continue
        
        multiplier = qty_g / base_qty
        
        total_energy_kcal += Decimal(str(ref_data.get("energy_kcal") or 0)) * multiplier
        total_energy_kj += Decimal(str(ref_data.get("energy_kj") or 0)) * multiplier
        total_protein += Decimal(str(ref_data.get("protein_g") or 0)) * multiplier
        total_carbs += Decimal(str(ref_data.get("carbs_g") or 0)) * multiplier
        total_lipid += Decimal(str(ref_data.get("lipid_g") or 0)) * multiplier
        total_sat_fat += Decimal(str(ref_data.get("saturated_fat_g") or 0)) * multiplier
        total_trans_fat += Decimal(str(ref_data.get("trans_fat_g") or 0)) * multiplier
        total_fiber += Decimal(str(ref_data.get("fiber_g") or 0)) * multiplier
        total_sodium += Decimal(str(ref_data.get("sodium_mg") or 0)) * multiplier
        has_any_data = True
        
    if not has_any_data:
        return existing_ref_id
        
    # Now divide by total_weight_g to get to 100g chunk
    total_weight_g = Decimal(str(total_weight_kg)) * 1000
    if total_weight_g <= 0: return existing_ref_id
    
    ratio_100g = Decimal("100") / total_weight_g
    
    new_nutri_data = {
        "description": f"Pré-preparo: {recipe_name}",
        "category": "Pre-preparo",
        "tbca_code": f"PRE-{uuid.uuid4().hex[:8]}".upper(),
        "base_qty_g": 100.0,
        "energy_kcal": float(round(total_energy_kcal * ratio_100g, 2)),
        "energy_kj": float(round(total_energy_kj * ratio_100g, 2)),
        "protein_g": float(round(total_protein * ratio_100g, 2)),
        "carbs_g": float(round(total_carbs * ratio_100g, 2)),
        "lipid_g": float(round(total_lipid * ratio_100g, 2)),
        "saturated_fat_g": float(round(total_sat_fat * ratio_100g, 2)),
        "trans_fat_g": float(round(total_trans_fat * ratio_100g, 2)),
        "fiber_g": float(round(total_fiber * ratio_100g, 2)),
        "sodium_mg": float(round(total_sodium * ratio_100g, 2))
    }
    
    if existing_ref_id:
        supabase.table("nutritional_ref").update(new_nutri_data).eq("id", existing_ref_id).execute()
        return existing_ref_id
    else:
        res = supabase.table("nutritional_ref").insert(new_nutri_data).execute()
        if res.data:
            return res.data[0]["id"]
            
    return None


@app.post("/api/recipes")
def create_recipe(payload: RecipeInput):
    """Create a new recipe with ingredients and labor cost."""
    logger.info(f"Creating recipe: {payload.name}")
    
    try:
        # 1. Fetch current prices for ingredients
        ing_ids = [i.ingredient_id for i in payload.ingredients]
        if ing_ids:
            ing_response = supabase.table("ingredients").select("id, current_price, yield_coefficient, category, nutritional_ref_id").in_("id", ing_ids).execute()
            price_map = {i["id"]: {
                "price": float(i.get("current_price") or 0), 
                "yield": float(i.get("yield_coefficient", 1) or 1), 
                "category": i.get("category", ""),
                "nutritional_ref_id": i.get("nutritional_ref_id")
            } for i in ing_response.data}
        else:
            price_map = {}
            
        # 2. Prepare ingredients list with prices for calculation
        calc_ingredients = []
        for item in payload.ingredients:
            ing_data = price_map.get(item.ingredient_id, {"price": 0, "yield": 1, "category": "", "nutritional_ref_id": None})
            calc_ingredients.append({
                "quantity": item.quantity,
                "current_price": ing_data["price"],
                "yield_coefficient": ing_data["yield"],
                "category": ing_data["category"],
                "nutritional_ref_id": ing_data.get("nutritional_ref_id")
            })
            
        # 3. Calculate totals
        totals = calculate_recipe_totals(
            payload.yield_units, 
            calc_ingredients, 
            Decimal(str(payload.labor_cost))
        )
        
        # 4. Handle pre-preparo derived ingredient and its nutrition
        derived_ing_id = None
        if getattr(payload, 'is_pre_preparo', False):
            # Calculate and materialize nutrition before creating the ingredient
            new_ref_id = materialize_pre_preparo_nutrition(
                payload.name, 
                calc_ingredients, 
                totals["total_weight_kg"]
            )
            
            ing_data = {
                "name": f"{payload.name}",
                "category": "Pré-preparo",
                "current_price": float(totals["cmv_per_unit"]),
                "yield_coefficient": 1.0,
                "unit": getattr(payload, 'production_unit', 'KG'),
                "nutritional_ref_id": new_ref_id
            }
            res_ing = supabase.table("ingredients").insert(ing_data).execute()
            if res_ing.data:
                derived_ing_id = res_ing.data[0]["id"]
                
        # 5. Insert Recipe
        recipe_data = {
            "name": payload.name,
            "yield_units": payload.yield_units,
            "labor_minutes": payload.labor_minutes,
            "labor_cost": payload.labor_cost,
            "ingredients_cost": totals["ingredients_cost"],
            "packaging_cost": totals["packaging_cost"],
            "sku": payload.sku,
            "product_id": payload.product_id,
            "current_cost": totals["current_cost"],
            "total_weight_kg": totals["total_weight_kg"],
            "is_pre_preparo": getattr(payload, 'is_pre_preparo', False),
            "category_id": payload.category_id,
            "derived_ingredient_id": derived_ing_id,
            "production_unit": getattr(payload, 'production_unit', 'KG'),
            # cmv_per_unit & cmv_per_kg are generated by DB
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
            .select("*, ingredients(name, unit, current_price, category, yield_coefficient, nutritional_ref_id)") \
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
            ing_response = supabase.table("ingredients").select("id, current_price, yield_coefficient, category, nutritional_ref_id").in_("id", ing_ids).execute()
            price_map = {i["id"]: {
                "price": float(i.get("current_price") or 0), 
                "yield": float(i.get("yield_coefficient", 1) or 1), 
                "category": i.get("category", ""),
                "nutritional_ref_id": i.get("nutritional_ref_id")
            } for i in ing_response.data}
        else:
            price_map = {}
            
        # 2. Calculate totals
        calc_ingredients = []
        for item in payload.ingredients:
            ing_data = price_map.get(item.ingredient_id, {"price": 0, "yield": 1, "category": "", "nutritional_ref_id": None})
            calc_ingredients.append({
                "quantity": item.quantity,
                "current_price": ing_data["price"],
                "yield_coefficient": ing_data["yield"],
                "category": ing_data["category"],
                "nutritional_ref_id": ing_data.get("nutritional_ref_id")
            })
            
        totals = calculate_recipe_totals(
            payload.yield_units, 
            calc_ingredients, 
            Decimal(str(payload.labor_cost))
        )
        
        # Fetch existing recipe to get derived_ingredient_id
        existing_recipe_res = supabase.table("recipes").select("derived_ingredient_id").eq("id", recipe_id).single().execute()
        existing_recipe = existing_recipe_res.data if existing_recipe_res else {}
        derived_ing_id = existing_recipe.get("derived_ingredient_id")
        
        # 3. Handle pre-preparo derived ingredient and its nutrition
        if getattr(payload, 'is_pre_preparo', False):
            existing_ref_id = None
            if derived_ing_id:
                # Need to fetch the current derived ingredient to get its nutritional_ref_id if any
                target_ing_res = supabase.table("ingredients").select("nutritional_ref_id").eq("id", derived_ing_id).execute()
                if target_ing_res.data:
                    existing_ref_id = target_ing_res.data[0].get("nutritional_ref_id")
                    
            updated_ref_id = materialize_pre_preparo_nutrition(
                payload.name, 
                calc_ingredients, 
                totals["total_weight_kg"],
                existing_ref_id=existing_ref_id
            )
            
            ing_data = {
                "name": f"{payload.name}",
                "category": "Pré-preparo",
                "current_price": float(totals["cmv_per_unit"]),
                "yield_coefficient": 1.0,
                "unit": getattr(payload, 'production_unit', 'KG'),
                "nutritional_ref_id": updated_ref_id
            }
            if derived_ing_id:
                supabase.table("ingredients").update(ing_data).eq("id", derived_ing_id).execute()
            else:
                res_ing = supabase.table("ingredients").insert(ing_data).execute()
                if res_ing.data:
                    derived_ing_id = res_ing.data[0]["id"]
        
        # 4. Update Recipe
        recipe_data = {
            "name": payload.name,
            "yield_units": payload.yield_units,
            "labor_minutes": payload.labor_minutes,
            "labor_cost": payload.labor_cost,
            "ingredients_cost": totals["ingredients_cost"],
            "packaging_cost": totals["packaging_cost"],
            "sku": payload.sku,
            "product_id": payload.product_id,
            "current_cost": totals["current_cost"],
            "total_weight_kg": totals["total_weight_kg"],
            "is_pre_preparo": getattr(payload, 'is_pre_preparo', False),
            "derived_ingredient_id": derived_ing_id,
            "production_unit": getattr(payload, 'production_unit', 'KG'),
            # cmv_per_unit & cmv_per_kg are generated by DB
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
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to delete recipe: {e}")
        raise HTTPException(500, f"Error deleting recipe: {str(e)}")


@app.get("/api/recipes/{recipe_id}/anvisa-label")
def get_recipe_anvisa_label(recipe_id: str):
    """
    Calculate and return the ANVISA nutritional label for a recipe.
    Calculates values per portion based on the recipe's category.
    """
    try:
        # 1. Fetch recipe and its category
        recipe_res = supabase.table("recipes").select("*, recipe_categories(name, anvisa_portion_g)").eq("id", recipe_id).single().execute()
        if not recipe_res.data:
            raise HTTPException(404, "Recipe not found")
        
        recipe = recipe_res.data
        category = recipe.get("recipe_categories")
        portion_g = float(category.get("anvisa_portion_g", 100)) if category else 100
        
        # 2. Fetch recipe ingredients and their nutritional data
        ing_res = supabase.table("recipe_ingredients") \
            .select("quantity, ingredients(id, nutritional_ref_id)") \
            .eq("recipe_id", recipe_id) \
            .execute()
            
        if not ing_res.data:
            raise HTTPException(400, "Recipe has no ingredients")

        # 3. Aggregate nutritional data
        nutri_ids = [i["ingredients"]["nutritional_ref_id"] for i in ing_res.data if i["ingredients"]["nutritional_ref_id"]]
        if not nutri_ids:
             return {
                "recipe_name": recipe["name"],
                "portion_g": portion_g,
                "error": "Nenhum ingrediente possui tabela nutricional vinculada."
            }

        nutri_res = supabase.table("nutritional_ref").select("*").in_("id", nutri_ids).execute()
        nutri_map = {n["id"]: n for n in nutri_res.data}

        # Totals for the entire batch
        batch_totals = {
            "energy_kcal": Decimal("0.0"),
            "carbs_g": Decimal("0.0"),
            "protein_g": Decimal("0.0"),
            "lipid_g": Decimal("0.0"),
            "saturated_fat_g": Decimal("0.0"),
            "trans_fat_g": Decimal("0.0"),
            "fiber_g": Decimal("0.0"),
            "sodium_mg": Decimal("0.0")
        }

        total_weight_g = Decimal(str(recipe.get("total_weight_kg", 0))) * 1000

        for item in ing_res.data:
            qty_g = Decimal(str(item["quantity"])) * 1000
            ref_id = item["ingredients"]["nutritional_ref_id"]
            if ref_id and ref_id in nutri_map:
                ref = nutri_map[ref_id]
                # Each ref value is per 100g
                factor = qty_g / Decimal("100.0")
                for key in batch_totals.keys():
                    val = ref.get(key)
                    if val is not None:
                        batch_totals[key] += Decimal(str(val)) * factor

        # 4. Calculate values per portion
        if total_weight_g <= 0:
            raise HTTPException(400, "Recipe total weight is zero")
            
        portion_factor = Decimal(str(portion_g)) / total_weight_g
        
        label_data = {
            "recipe_name": recipe["name"],
            "category_name": category["name"] if category else "Geral",
            "portion_g": portion_g,
            "values": {},
            "vd_percentages": {}
        }

        for key, total_batch_val in batch_totals.items():
            val_per_portion = float(total_batch_val * portion_factor)
            label_data["values"][key] = round(val_per_portion, 1)
            
            if key in ANVISA_VD:
                vd_val = ANVISA_VD[key]
                label_data["vd_percentages"][key] = round((val_per_portion / vd_val) * 100)

        return label_data

    except Exception as e:
        logger.error(f"Failed to generate ANVISA label for recipe {recipe_id}: {e}")
        raise HTTPException(500, f"Error generating label: {str(e)}")


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
