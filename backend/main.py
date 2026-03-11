"""
FastAPI Backend - Radar de Preço & CMV
Main application with REST API endpoints.
"""

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
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

from backend.integrations.mercadopago_client import MercadoPagoClient
from backend.integrations.stripe_client import StripeClient
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


class ProductionProcessInput(BaseModel):
    name: str
    expected_duration_minutes: int
    yield_notes: Optional[str] = None


class RecipeProcessInput(BaseModel):
    recipe_id: Optional[str] = None
    process_id: str
    sort_order: int = 0
    time_per_unit_minutes: float = 1.0

class RecipeProcessUpdate(BaseModel):
    sort_order: Optional[int] = None
    time_per_unit_minutes: Optional[float] = None

class BulkScheduleInput(BaseModel):
    recipe_id: str
    quantity: float
    planned_date: str  # yyyy-MM-dd

class ProductionScheduleInput(BaseModel):
    planned_date: Optional[datetime] = None
    start_time: Optional[str] = None   # formato "HH:MM:SS"
    process_id: Optional[str] = None
    custom_item_name: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None

class AddExpenseRequest(BaseModel):
    description: str
    amount: float
    category_name: str
    parent_category_name: Optional[str] = None
    record_date: Optional[str] = None


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
    product_id: Optional[str] = None
    is_pre_preparo: bool = False
    derived_ingredient_id: Optional[str] = None
    production_unit: Optional[str] = "KG"
    net_weight: Optional[float] = None
    sauce_yield_kg: Optional[float] = None
    status: Optional[str] = "ativo"
    ingredients: List[RecipeIngredientInput]



# ============= Nutrition Constants =============

ANVISA_VD = {
    "energy_kcal": 2000,
    "carbs_g": 300,
    "sugars_total_g": None,  # Não há VD definido oficialmente pela ANVISA para totais
    "sugars_added_g": 50,
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
        "total_weight_kg": float(total_weight), # Input weight
        "cmv_per_unit": float(cmv_per_unit),
        "cmv_per_kg": float(cmv_per_kg)
    }

def materialize_pre_preparo_nutrition(recipe_name: str, calc_ingredients: List[dict], finished_weight_kg: float, existing_ref_id: Optional[str] = None) -> Optional[str]:
    """Calculate and materialize nutrition for 100g of a pre-preparo recipe."""
    if finished_weight_kg <= 0:
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
    total_sugars_total = Decimal("0")
    total_sugars_added = Decimal("0")
    
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
        total_sugars_total += Decimal(str(ref_data.get("sugars_total_g") or 0)) * multiplier
        total_sugars_added += Decimal(str(ref_data.get("sugars_added_g") or 0)) * multiplier
        has_any_data = True
        
    if not has_any_data:
        return existing_ref_id
        
    # Now divide by total_weight_g to get to 100g chunk
    total_weight_g = Decimal(str(finished_weight_kg)) * 1000
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
        "sodium_mg": float(round(total_sodium * ratio_100g, 2)),
        "sugars_total_g": float(round(total_sugars_total * ratio_100g, 2)),
        "sugars_added_g": float(round(total_sugars_added * ratio_100g, 2))
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
            # Calculate finished weight for nutrition accuracy
            yield_units = Decimal(str(payload.yield_units or 0))
            net_weight = Decimal(str(payload.net_weight or 0)) if payload.net_weight else Decimal("0")
            prod_unit = getattr(payload, 'production_unit', 'KG').upper()
            if prod_unit == "KG" and yield_units > 0:
                finished_weight_kg = float(yield_units)
            elif yield_units > 0 and net_weight > 0:
                finished_weight_kg = float(yield_units * net_weight)
            else:
                finished_weight_kg = totals["total_weight_kg"]

            new_ref_id = materialize_pre_preparo_nutrition(
                payload.name, 
                calc_ingredients, 
                finished_weight_kg
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
            "net_weight": payload.net_weight,
            "sauce_yield_kg": payload.sauce_yield_kg,
            "status": getattr(payload, 'status', 'ativo') or 'ativo',
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


# ============= Recipe Processes CRUD =============
# NOTE: These must be registered BEFORE /api/recipes/{recipe_id} to avoid route shadowing

@app.get("/api/recipes/{recipe_id}/processes")
def get_recipe_processes(recipe_id: str):
    """Lista processos vinculados a uma receita, ordenados por sort_order."""
    try:
        result = supabase.table("recipe_processes") \
            .select("*, production_processes(id, name, expected_duration_minutes)") \
            .eq("recipe_id", recipe_id) \
            .order("sort_order") \
            .execute()
        return result.data
    except Exception as e:
        logger.error(f"Error fetching recipe processes: {e}")
        raise HTTPException(500, str(e))

@app.post("/api/recipes/{recipe_id}/processes")
def add_recipe_process(recipe_id: str, data: RecipeProcessInput):
    """Vincula um processo a uma receita."""
    try:
        payload = data.model_dump()
        payload["recipe_id"] = recipe_id
        result = supabase.table("recipe_processes").insert(payload).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error adding recipe process: {e}")
        raise HTTPException(500, str(e))

@app.get("/api/recipes/{recipe_id}/resolve-slots")
def resolve_recipe_slots(recipe_id: str, quantity: float):
    """
    Dado uma receita e quantidade, retorna a lista completa de slots
    incluindo pré-preparos em cascata. Não salva nada — apenas calcula.
    """
    slots = []
    visited = set()

    def resolve(rid: str, qty: float, parent_name: str = ""):
        if rid in visited:
            return
        visited.add(rid)

        recipe_res = supabase.table("recipes").select("*").eq("id", rid).single().execute()
        recipe = recipe_res.data
        recipe_name = recipe["name"]
        yield_units = float(recipe["yield_units"]) if recipe.get("yield_units") else 1.0

        rp_res = supabase.table("recipe_processes") \
            .select("*, production_processes(id, name, expected_duration_minutes)") \
            .eq("recipe_id", rid) \
            .order("sort_order") \
            .execute()

        for rp in (rp_res.data or []):
            proc = rp["production_processes"]
            duration = round(qty * float(rp["time_per_unit_minutes"]), 1)
            label = f"{recipe_name} — {proc['name']}"
            if parent_name:
                label = f"[{parent_name}] {label}"
            slots.append({
                "recipe_id": rid,
                "recipe_name": recipe_name,
                "process_id": proc["id"],
                "process_name": proc["name"],
                "label": label,
                "duration_minutes": duration,
                "quantity": qty,
                "is_sub_preparo": bool(parent_name),
                "sort_order": rp["sort_order"],
            })

        ing_res = supabase.table("recipe_ingredients") \
            .select("*, ingredients(id, name, current_price, category)") \
            .eq("recipe_id", rid) \
            .execute()

        for ing in (ing_res.data or []):
            ingredient = ing.get("ingredients", {})
            if not ingredient or ingredient.get("category") != "PRÉ-PREPARO":
                continue
            pp_res = supabase.table("recipes") \
                .select("id, name, yield_units, is_pre_preparo") \
                .eq("derived_ingredient_id", ingredient["id"]) \
                .eq("is_pre_preparo", True) \
                .execute()
            if not pp_res.data:
                continue
            pp_recipe = pp_res.data[0]
            pp_yield = float(pp_recipe["yield_units"]) if pp_recipe.get("yield_units") else 1.0
            needed_amount = qty * float(ing["quantity"]) / yield_units
            resolve(pp_recipe["id"], needed_amount, parent_name=recipe_name)

    resolve(recipe_id, quantity)
    return {"slots": slots, "total_minutes": sum(s["duration_minutes"] for s in slots)}


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
    logger.info(f"Received payload category_id: {payload.category_id}, product_id: {payload.product_id}")
    
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
                    
            # Calculate finished weight for nutrition accuracy
            yield_units = Decimal(str(payload.yield_units or 0))
            net_weight = Decimal(str(payload.net_weight or 0)) if payload.net_weight else Decimal("0")
            prod_unit = getattr(payload, 'production_unit', 'KG').upper()
            if prod_unit == "KG" and yield_units > 0:
                finished_weight_kg = float(yield_units)
            elif yield_units > 0 and net_weight > 0:
                finished_weight_kg = float(yield_units * net_weight)
            else:
                finished_weight_kg = totals["total_weight_kg"]

            updated_ref_id = materialize_pre_preparo_nutrition(
                payload.name, 
                calc_ingredients, 
                finished_weight_kg,
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
            "category_id": payload.category_id,
            "derived_ingredient_id": derived_ing_id,
            "production_unit": getattr(payload, 'production_unit', 'KG'),
            "net_weight": payload.net_weight,
            "status": getattr(payload, 'status', 'ativo') or 'ativo',
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
            "sugars_total_g": Decimal("0.0"),
            "sugars_added_g": Decimal("0.0"),
            "protein_g": Decimal("0.0"),
            "lipid_g": Decimal("0.0"),
            "saturated_fat_g": Decimal("0.0"),
            "trans_fat_g": Decimal("0.0"),
            "fiber_g": Decimal("0.0"),
            "sodium_mg": Decimal("0.0")
        }

        # Calculate finished weight based on yield
        yield_units = Decimal(str(recipe.get("yield_units") or 0))
        net_weight = Decimal(str(recipe.get("net_weight") or 0)) if recipe.get("net_weight") else Decimal("0")
        production_unit = recipe.get("production_unit", "KG").upper()

        if production_unit == "KG" and yield_units > 0:
            finished_weight_g = yield_units * 1000
        elif yield_units > 0 and net_weight > 0:
            finished_weight_g = yield_units * net_weight * 1000
        else:
            # Fallback to input weight if yield info is missing
            finished_weight_g = Decimal(str(recipe.get("total_weight_kg", 0))) * 1000

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
        if finished_weight_g <= 0:
            raise HTTPException(400, "Recipe finished weight is zero")
            
        portion_factor = Decimal(str(portion_g)) / finished_weight_g
        factor_100g = Decimal("100.0") / finished_weight_g
        
        label_data = {
            "recipe_name": recipe["name"],
            "category_name": category["name"] if category else "Geral",
            "anvisa_portion_g": portion_g,
            "nutrients": {},
            "nutrients_100g": {},
            "daily_values": {},
            "high_in": {
                "sugars_added": False,
                "saturated_fat": False,
                "sodium": False
            }
        }

        # Mapping between internal names and frontend names
        key_map = {
            "energy_kcal": "energetic_value_kcal",
            "energy_kj": "energetic_value_kj",
            "carbs_g": "carbohydrates_g",
            "sugars_total_g": "sugars_total_g",
            "sugars_added_g": "sugars_added_g",
            "protein_g": "proteins_g",
            "lipid_g": "fats_total_g",
            "saturated_fat_g": "fats_saturated_g",
            "trans_fat_g": "fats_trans_g",
            "fiber_g": "fibers_g",
            "sodium_mg": "sodium_mg"
        }

        vd_map = {
            "energy_kcal": "energetic_value",
            "carbs_g": "carbohydrates",
            "sugars_added_g": "sugars_added",
            "protein_g": "proteins",
            "lipid_g": "fats_total",
            "saturated_fat_g": "fats_saturated",
            "fiber_g": "fibers",
            "sodium_mg": "sodium"
        }

        # Thresholds for FOP (Lupa) per 100g
        fop_thresholds = {
            "sugars_added_g": 15,
            "saturated_fat_g": 6,
            "sodium_mg": 600
        }

        for key, total_batch_val in batch_totals.items():
            # Value for the specific portion
            val_per_portion = float(total_batch_val * portion_factor)
            # Value per 100g for FOP (Lupa) check and second column
            val_100g = float(total_batch_val * factor_100g)
            
            fe_key = key_map.get(key, key)
            label_data["nutrients"][fe_key] = round(val_per_portion, 1)
            label_data["nutrients_100g"][fe_key] = round(val_100g, 1)
            
            # Check Lupa limits
            if key == "sugars_added_g" and val_100g >= fop_thresholds["sugars_added_g"]:
                label_data["high_in"]["sugars_added"] = True
            elif key == "saturated_fat_g" and val_100g >= fop_thresholds["saturated_fat_g"]:
                label_data["high_in"]["saturated_fat"] = True
            elif key == "sodium_mg" and val_100g >= fop_thresholds["sodium_mg"]:
                label_data["high_in"]["sodium"] = True

            # %VD
            if key in ANVISA_VD and ANVISA_VD[key] is not None:
                vd_val = ANVISA_VD[key]
                vd_fe_key = vd_map.get(key, key)
                label_data["daily_values"][vd_fe_key] = round((val_per_portion / vd_val) * 100)

        return label_data

    except Exception as e:
        logger.error(f"Failed to generate ANVISA label for recipe {recipe_id}: {e}")
        raise HTTPException(500, f"Error generating label: {str(e)}")


@app.get("/api/nutrition/report")
def get_nutrition_report():
    """
    Get consolidated nutritional report for all recipes using two separate queries for reliability.
    """
    try:
        # Get nutrition data
        nut_response = supabase.table("recipe_nutrition").select("*").execute()
        # Get recipe names and types
        rec_response = supabase.table("recipes").select("id, name, is_pre_preparo").execute()
        
        name_map = {r["id"]: r["name"] for r in rec_response.data}
        # Filter (optional: you might want to show pre-preparos too, but usually users want products)
        # For now let's show everything that has nutrition data
        
        report = []
        for row in nut_response.data:
            recipe_id = row.get("recipe_id")
            report.append({
                "id": recipe_id,
                "name": name_map.get(recipe_id, "N/A"),
                "energy_kcal": row.get("energy_kcal_100g", 0) or 0,
                "carbs_g": row.get("carbs_g_100g", 0) or 0,
                "sugars_total_g": row.get("sugars_total_g_100g", 0) or 0,
                "sugars_added_g": row.get("sugars_added_g_100g", 0) or 0,
                "protein_g": row.get("protein_g_100g", 0) or 0,
                "lipid_g": row.get("lipid_g_100g", 0) or 0,
                "saturated_fat_g": row.get("saturated_fat_g_100g", 0) or 0,
                "trans_fat_g": row.get("trans_fat_g_100g", 0) or 0,
                "fiber_g": row.get("fiber_g_100g", 0) or 0,
                "sodium_mg": row.get("sodium_mg_100g", 0) or 0
            })
            
        return report

    except Exception as e:
        logger.error(f"Failed to fetch nutrition report: {e}")
        raise HTTPException(500, f"Error fetching report: {str(e)}")


@app.get("/api/recipes")
def list_recipes(status: Optional[str] = "ativo"):
    """List recipes filtered by status. Defaults to 'ativo'."""
    logger.debug(f"Fetching recipes with status={status}")
    response = supabase.table("recipes") \
        .select("*") \
        .eq("status", status) \
        .order("name") \
        .execute()
    
    return response.data

# ============= Production Endpoints =============

@app.get("/api/production/processes")
def list_production_processes():
    """List all standard production processes, with default_time_per_unit from last usage."""
    try:
        response = supabase.table("production_processes") \
            .select("*, recipe_processes(time_per_unit_minutes)") \
            .order("name") \
            .execute()
        for proc in response.data:
            rps = proc.pop("recipe_processes", [])
            proc["default_time_per_unit"] = rps[0]["time_per_unit_minutes"] if rps else None
        return response.data
    except Exception as e:
        logger.error(f"Error fetching production processes: {e}")
        raise HTTPException(500, f"Erro ao buscar processos de produção: {str(e)}")


@app.post("/api/production/processes")
def create_production_process(process: ProductionProcessInput):
    """Create a new standard production process."""
    try:
        response = supabase.table("production_processes").insert(process.model_dump(exclude_unset=True)).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating production process: {e}")
        raise HTTPException(500, f"Erro ao criar processo de produção: {str(e)}")


@app.put("/api/production/processes/{process_id}")
def update_production_process(process_id: str, process: ProductionProcessInput):
    """Update a standard production process."""
    try:
        update_data = process.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase.table("production_processes").update(update_data).eq("id", process_id).execute()
        if not response.data:
            raise HTTPException(404, "Processo não encontrado")
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error(f"Error updating production process: {e}")
        raise HTTPException(500, f"Erro ao atualizar processo de produção: {str(e)}")


@app.delete("/api/production/processes/{process_id}")
def delete_production_process(process_id: str):
    """Delete a standard production process and its recipe links."""
    try:
        # Remover vínculos em recipe_processes primeiro (FK constraint)
        supabase.table("recipe_processes").delete().eq("process_id", process_id).execute()
        response = supabase.table("production_processes").delete().eq("id", process_id).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting production process: {e}")
        raise HTTPException(500, f"Erro ao deletar processo de produção: {str(e)}")


@app.get("/api/production/schedule")
def list_production_schedule(start_date: str, end_date: str):
    """List production schedule entries within a date range."""
    # start_date and end_date should be YYYY-MM-DD
    try:
        response = supabase.table("production_schedule") \
            .select("*, production_processes(name)") \
            .gte("planned_date", start_date) \
            .lte("planned_date", end_date) \
            .order("planned_date") \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching production schedule: {e}")
        raise HTTPException(500, f"Erro ao buscar programação de produção: {str(e)}")


@app.post("/api/production/schedule")
def create_production_schedule(entry: ProductionScheduleInput):
    """Create a new production schedule entry."""
    try:
        if not entry.process_id and not entry.custom_item_name:
            raise HTTPException(400, "Deve informar um process_id ou um custom_item_name")
            
        data = entry.model_dump(exclude_unset=True)
        # Ensure dates are strings for Supabase Insert
        if isinstance(data.get("planned_date"), datetime):
            data["planned_date"] = data["planned_date"].date().isoformat()
            
        response = supabase.table("production_schedule").insert(data).execute()
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error(f"Error creating schedule entry: {e}")
        raise HTTPException(500, f"Erro ao criar registro na agenda: {str(e)}")


@app.put("/api/production/schedule/{schedule_id}")
def update_production_schedule(schedule_id: str, entry: ProductionScheduleInput):
    """Update a production schedule entry (status, duration, etc)."""
    try:
        update_data = entry.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        if isinstance(update_data.get("planned_date"), datetime):
            update_data["planned_date"] = update_data["planned_date"].date().isoformat()
            
        response = supabase.table("production_schedule").update(update_data).eq("id", schedule_id).execute()
        if not response.data:
            raise HTTPException(404, "Agendamento não encontrado")
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.error(f"Error updating schedule entry: {e}")
        raise HTTPException(500, f"Erro ao atualizar registro na agenda: {str(e)}")


@app.delete("/api/production/schedule/{schedule_id}")
def delete_production_schedule(schedule_id: str):
    """Delete a production schedule entry."""
    try:
        response = supabase.table("production_schedule").delete().eq("id", schedule_id).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting schedule entry: {e}")
        raise HTTPException(500, f"Erro ao deletar registro na agenda: {str(e)}")




@app.put("/api/recipe-processes/{rp_id}")
def update_recipe_process(rp_id: str, data: RecipeProcessUpdate):
    """Atualiza sort_order ou time_per_unit_minutes."""
    try:
        payload = {k: v for k, v in data.model_dump().items() if v is not None}
        result = supabase.table("recipe_processes").update(payload).eq("id", rp_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error updating recipe process: {e}")
        raise HTTPException(500, str(e))

@app.get("/api/production/processes/{process_id}/usage-count")
def get_process_usage_count(process_id: str):
    """Conta quantas receitas usam este processo."""
    try:
        result = supabase.table("recipe_processes") \
            .select("recipe_id, recipes(name)") \
            .eq("process_id", process_id) \
            .execute()
        recipes = [r["recipes"]["name"] for r in (result.data or []) if r.get("recipes")]
        return {"count": len(recipes), "recipes": recipes}
    except Exception as e:
        logger.error(f"Error counting process usage: {e}")
        raise HTTPException(500, str(e))

@app.put("/api/production/processes/{process_id}/update-cascade")
def update_process_cascade(process_id: str, data: dict):
    """Atualiza processo e recalcula time_per_unit em todas as recipe_processes vinculadas."""
    try:
        new_name = data.get("name")
        new_time_per_unit = data.get("time_per_unit_minutes")

        update_payload = {}
        if new_name:
            update_payload["name"] = new_name
        if new_time_per_unit is not None:
            update_payload["expected_duration_minutes"] = round(new_time_per_unit)
        if update_payload:
            update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
            supabase.table("production_processes").update(update_payload).eq("id", process_id).execute()

        if new_time_per_unit is not None:
            supabase.table("recipe_processes") \
                .update({"time_per_unit_minutes": new_time_per_unit}) \
                .eq("process_id", process_id) \
                .execute()

        return {"ok": True}
    except Exception as e:
        logger.error(f"Error cascading process update: {e}")
        raise HTTPException(500, str(e))

@app.delete("/api/recipe-processes/{rp_id}")
def delete_recipe_process(rp_id: str):
    """Remove vínculo processo-receita."""
    try:
        supabase.table("recipe_processes").delete().eq("id", rp_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.error(f"Error deleting recipe process: {e}")
        raise HTTPException(500, str(e))






# ============= Bulk Schedule Recipe =============

@app.post("/api/production/schedule-recipe")
def schedule_recipe(data: BulkScheduleInput):
    """
    Agenda uma receita inteira: resolve slots (com cascata) e cria
    todas as entradas em production_schedule de uma vez.
    """
    slots_response = resolve_recipe_slots(data.recipe_id, data.quantity)
    slots = slots_response["slots"]

    created = []
    for slot in slots:
        entry = {
            "planned_date": data.planned_date,
            "process_id": slot["process_id"],
            "custom_item_name": slot["label"],
            "duration_minutes": max(1, round(slot["duration_minutes"])),
            "status": "pending",
        }
        result = supabase.table("production_schedule").insert(entry).execute()
        if result.data:
            created.append(result.data[0])

    return {"created": len(created), "entries": created}


# ============= Settings Endpoints =============

@app.get("/api/settings")
def get_settings():
    """Get global application settings from integration_settings table."""
    try:
        response = supabase.table("integration_settings").select("settings").eq("service_name", "app_config").execute()
        if response.data:
            return response.data[0]["settings"]
        return {} # Return empty if not found so frontend uses localStorage fallback
    except Exception as e:
        logger.error(f"Error fetching settings: {e}")
        return {}

@app.post("/api/settings")
def save_settings(payload: dict):
    """Save global application settings to integration_settings table."""
    try:
        # Check if exists
        response = supabase.table("integration_settings").select("id").eq("service_name", "app_config").execute()
        
        update_data = {
            "settings": payload,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if response.data:
            res = supabase.table("integration_settings").update(update_data).eq("service_name", "app_config").execute()
        else:
            res = supabase.table("integration_settings").insert({
                "service_name": "app_config",
                **update_data
            }).execute()
            
        # Check for errors in the response object (some SDK versions don't raise)
        if hasattr(res, 'error') and res.error:
            raise Exception(str(res.error))
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(500, f"Erro ao salvar configurações: {str(e)}")




# ============= Financeiro: Módulo DRE =============


@app.get("/api/financeiro/dre")
def get_dre(year: int, month: int):
    """Retorna a DRE completa para o período: receita por canal, expenses e depreciação."""
    from calendar import monthrange
    start_date = f"{year}-{month:02d}-01"
    _, last_day = monthrange(year, month)
    end_date = f"{year}-{month:02d}-{last_day}"

    try:
        channels_res = supabase.table("sales_channels").select("name, dre_names").execute()
        channels = channels_res.data or []

        def get_channel_name(store_number):
            if not store_number:
                return "Outros"
            for ch in channels:
                channel_name = ch.get("name")
                aliases = ch.get("dre_names") or []
                if store_number == channel_name or store_number in aliases:
                    return channel_name
            return "Outros"

        # Query orders strictly excluding Cancelado and the gift order 5713
        orders_res = (
            supabase.table("orders")
            .select("order_id, order_number, store_number, shipping, status_text, total_promotion")
            .gte("order_date", start_date)
            .lte("order_date", end_date)
            .execute()
        )
        orders_all = orders_res.data or []
        
        # Filtro: Excluir Cancelado e o pedido 5713 (Amostra/Presente)
        orders = []
        for o in orders_all:
            status = (o.get("status_text") or "").strip().lower()
            num = str(o.get("order_number") or "")
            if status != "cancelado" and num != "5713":
                orders.append(o)

        from collections import defaultdict
        channel_agg = defaultdict(lambda: {
            "receita_bruta": 0.0, "qtd_pedidos": 0, "qtd_itens": 0.0, "cmv_total": 0.0
        })

        order_ids = [o["order_id"] for o in orders]
        order_channel_map = {o["order_id"]: get_channel_name(o.get("store_number")) for o in orders}
        shipping_map = {o["order_id"]: float(o.get("shipping") or 0) for o in orders}

        if order_ids:
            # 1. Fetch items
            items_res = (
                supabase.table("orders_items")
                .select("order_id, product_id, quantity, products(product_price, preco_revenda, unit_ingredients_cost, unit_packaging_cost, unit_labor_cost)")
                .in_("order_id", order_ids)
                .execute()
            )
            
            # 2. Pre-fetch historical CMV for ALL products in these orders
            all_pids = list(set([it["product_id"] for it in items_res.data if it.get("product_id")]))
            history_res = (
                supabase.table("cmv_history")
                .select("product_id, cmv_per_unit, recorded_at")
                .in_("product_id", all_pids)
                .lte("recorded_at", end_date)
                .order("recorded_at")
                .execute()
            )
            
            # Group history by product
            history_map = defaultdict(list)
            for h in (history_res.data or []):
                history_map[h["product_id"]].append(h)
            
            # Map order dates for efficiency
            order_date_map = {o["order_id"]: (o.get("order_date") or "") for o in orders}
            store_map = {o["order_id"]: (o.get("store_number") or "").lower() for o in orders}

            for item in (items_res.data or []):
                o_id = item["order_id"]
                canal = order_channel_map.get(o_id, "Outros")
                qty = float(item.get("quantity") or 0)
                channel_agg[canal]["qtd_itens"] += qty
                
                prod = item.get("products") or {}
                p_id = item.get("product_id")
                
                # CMV Calculation - Point in Time
                order_date = order_date_map.get(o_id)
                cmv_unit = 0.0
                
                if p_id and order_date and p_id in history_map:
                    # Find last record <= order_date
                    for h in history_map[p_id]:
                        h_date = h["recorded_at"][:10] if h["recorded_at"] else ""
                        if h_date <= order_date:
                            cmv_unit = float(h.get("cmv_per_unit") or 0)
                        else:
                            break
                
                # Fallback to current product cost if history not found OR cmv was zero
                if cmv_unit == 0:
                    cmv_unit = (
                        float(prod.get("unit_ingredients_cost") or 0)
                        + float(prod.get("unit_packaging_cost") or 0)
                        + float(prod.get("unit_labor_cost") or 0)
                    )
                
                channel_agg[canal]["cmv_total"] += cmv_unit * qty
                
                # Preço de Tabela (Retail or Revenda)
                store = store_map.get(o_id, "")
                is_revenda = "revenda" in store or "catering" in store or "restaurante" in store
                catalog_price = float(prod.get("preco_revenda") or prod.get("product_price") or 0) if is_revenda else float(prod.get("product_price") or 0)
                
                # Receita Bruta (Catalog Price * Qty)
                channel_agg[canal]["receita_bruta"] += catalog_price * qty

        # Add shipping to revenue per channel
        for o in orders:
            canal = order_channel_map.get(o["order_id"], "Outros")
            shipping = float(o.get("shipping") or 0)
            channel_agg[canal]["receita_bruta"] += shipping
            channel_agg[canal]["qtd_pedidos"] += 1

        canais_result = []
        for nome, d in channel_agg.items():
            ticket = d["receita_bruta"] / d["qtd_pedidos"] if d["qtd_pedidos"] > 0 else 0
            canais_result.append({
                "nome": nome,
                "receita_bruta": round(d["receita_bruta"], 2),
                "qtd_pedidos": d["qtd_pedidos"],
                "ticket_medio": round(ticket, 2),
                "qtd_itens": round(d["qtd_itens"], 2),
                "cmv_total": round(d["cmv_total"], 2),
            })

        all_cats_res = supabase.table("financial_categories").select("id, name, parent_category").execute()
        cat_map = {c["id"]: c for c in (all_cats_res.data or [])}

        expenses_res = (
            supabase.table("expenses_records")
            .select("id, description, amount, record_date, category_id, financial_categories(name, type, parent_category)")
            .gte("record_date", start_date)
            .lte("record_date", end_date)
            .execute()
        )
        expenses = []
        for e in (expenses_res.data or []):
            cat = e.get("financial_categories") or {}
            parent_id = cat.get("parent_category")
            expenses.append({
                "id": e["id"],
                "description": e.get("description", ""),
                "amount": float(e.get("amount") or 0),
                "record_date": e.get("record_date", ""),
                "category_id": e.get("category_id", ""),
                "category_name": cat.get("name", ""),
                "category_type": cat.get("type", ""),
                "parent_category_name": cat_map.get(parent_id, {}).get("name", "") if parent_id else "",
            })

        assets_res = supabase.table("fixed_assets").select("purchase_value, useful_life_months").execute()
        depreciacao = sum(
            float(a["purchase_value"]) / int(a["useful_life_months"])
            for a in (assets_res.data or [])
            if a.get("purchase_value") and a.get("useful_life_months")
        )

        receita_bruta_total = sum(c["receita_bruta"] for c in canais_result)
        cmv_total = sum(c["cmv_total"] for c in canais_result)

        def sum_cat(cat_name):
            return sum(e["amount"] for e in expenses if e["category_name"] == cat_name)

        promocoes_orders = sum(float(o.get("total_promotion") or 0) for o in orders)
        promocoes = sum_cat("Promoções") + promocoes_orders
        das = sum_cat("DAS (Simples Nacional)")
        devolucoes = sum_cat("Devoluções")
        deducoes_total = promocoes + das + devolucoes
        receita_liquida = receita_bruta_total - deducoes_total
        resultado_bruto = receita_liquida - cmv_total
        exclude_ebitda = ["Depreciação de maquinário", "Juros de Empréstimos", "Impostos sobre Lucro"]
        total_despesas = sum(
            e["amount"] for e in expenses
            if e["category_type"] in ("DESPESA_FIXA", "DESPESA_VARIAVEL")
            and e["category_name"] not in exclude_ebitda
        )
        
        juros = sum_cat("Juros de Empréstimos")
        impostos_lucro = sum_cat("Impostos sobre Lucro")
        manual_deprec = sum_cat("Depreciação de maquinário")
        final_deprec = manual_deprec if manual_deprec > 0 else depreciacao

        ebitda = resultado_bruto - total_despesas
        resultado_liquido = ebitda - round(final_deprec, 2) - juros - impostos_lucro

        cmv_pct = (cmv_total / receita_bruta_total * 100) if receita_bruta_total > 0 else 0
        margem_bruta = (resultado_bruto / receita_bruta_total * 100) if receita_bruta_total > 0 else 0
        margem_liquida = (resultado_liquido / receita_bruta_total * 100) if receita_bruta_total > 0 else 0

        return {
            "year": year, "month": month,
            "canais": canais_result,
            "expenses": expenses,
            "depreciacao": round(final_deprec, 2),
            "summary": {
                "receita_bruta_total": round(receita_bruta_total, 2),
                "deducoes": {"total": round(deducoes_total, 2), "promocoes": round(promocoes, 2), "das": round(das, 2), "devolucoes": round(devolucoes, 2)},
                "receita_liquida": round(receita_liquida, 2),
                "cmv_total": round(cmv_total, 2),
                "cmv_percentual": round(cmv_pct, 2),
                "resultado_bruto": round(resultado_bruto, 2),
                "margem_bruta": round(margem_bruta, 2),
                "total_despesas": round(total_despesas, 2),
                "ebitda": round(ebitda, 2),
                "depreciacao": round(depreciacao, 2),
                "resultado_liquido": round(resultado_liquido, 2),
                "margem_liquida": round(margem_liquida, 2),
            },
        }
    except Exception as e:
        logger.error(f"[DRE] Erro ao calcular DRE {year}/{month}: {e}")
        raise HTTPException(500, f"Erro ao gerar DRE: {str(e)}")


@app.post("/api/financeiro/expenses")
def add_expense_record(req: AddExpenseRequest):
    """Registra uma despesa manual pelo nome da categoria e opcionalmente pelo pai."""
    try:
        query = supabase.table("financial_categories").select("id, parent_category").eq("name", req.category_name)
        cat_res = query.execute()
        
        if not cat_res.data:
            raise HTTPException(404, f"Categoria '{req.category_name}' não encontrada.")
        
        target_id = None
        if len(cat_res.data) > 1 and req.parent_category_name:
            # Desambiguação pelo pai
            parent_res = supabase.table("financial_categories").select("id").eq("name", req.parent_category_name).execute()
            if parent_res.data:
                p_ids = [p["id"] for p in parent_res.data]
                for c in cat_res.data:
                    if c["parent_category"] in p_ids:
                        target_id = c["id"]
                        break
        
        if not target_id:
            target_id = cat_res.data[0]["id"]

        record = {
            "description": req.description,
            "amount": req.amount,
            "category_id": target_id,
            "record_date": req.record_date or datetime.now().strftime("%Y-%m-%d"),
        }
        res = supabase.table("expenses_records").insert(record).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DRE] Erro ao adicionar despesa: {e}")
        raise HTTPException(500, f"Erro ao salvar despesa: {str(e)}")


@app.delete("/api/financeiro/expenses/{expense_id}")
def delete_expense_record(expense_id: str):
    """Remove um registro de despesa."""
    try:
        supabase.table("expenses_records").delete().eq("id", expense_id).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"[DRE] Erro ao deletar despesa {expense_id}: {e}")
        raise HTTPException(500, f"Erro ao remover despesa: {str(e)}")


@app.get("/api/financeiro/inadimplencia")
def get_inadimplencia():
    """Retorna pedidos em aberto há mais de 60 dias de canais de crédito."""
    from datetime import timedelta
    try:
        sixty_days_ago = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        orders_res = (
            supabase.table("orders")
            .select("order_id, order_number, order_date, order_total, store_number, customers(name)")
            .lte("order_date", sixty_days_ago)
            .eq("status_text", "Em Aberto")
            .execute()
        )
        channels_res = supabase.table("sales_channels").select("name, dre_names").execute()
        credit_store_numbers = []
        for ch in (channels_res.data or []):
            nome = (ch.get("name") or "").lower()
            if any(kw in nome for kw in ["chat", "atendimento", "revenda", "b2b"]):
                credit_store_numbers.extend(ch.get("dre_names") or [])

        flagged = []
        for o in (orders_res.data or []):
            if o.get("store_number") in credit_store_numbers:
                customer = o.get("customers") or {}
                flagged.append({
                    "order_id": o["order_id"],
                    "order_number": o.get("order_number"),
                    "order_date": o.get("order_date"),
                    "order_total": float(o.get("order_total") or 0),
                    "store_number": o.get("store_number"),
                    "customer_name": customer.get("name", ""),
                })
        return {"flagged_orders": flagged, "total": len(flagged)}
    except Exception as e:
        logger.error(f"[DRE] Erro ao buscar inadimplência: {e}")
        raise HTTPException(500, f"Erro ao buscar inadimplência: {str(e)}")


@app.post("/api/financeiro/inadimplencia/{order_id}/confirmar")
def confirm_inadimplencia(order_id: int, payload: dict):
    """Registra um pedido como inadimplência em expenses_records."""
    try:
        month_str = payload.get("month", datetime.now().strftime("%Y-%m"))
        order_res = supabase.table("orders").select("order_total, order_number, customers(name)").eq("order_id", order_id).execute()
        if not order_res.data:
            raise HTTPException(404, "Pedido não encontrado.")
        order = order_res.data[0]
        cat_res = supabase.table("financial_categories").select("id").eq("name", "Inadimplência").execute()
        if not cat_res.data:
            raise HTTPException(404, "Categoria 'Inadimplência' não encontrada.")
        customer = order.get("customers") or {}
        supabase.table("expenses_records").insert({
            "description": f"Inadimplência — Pedido #{order.get('order_number')} ({customer.get('name', 'Cliente')})",
            "amount": float(order.get("order_total") or 0),
            "category_id": cat_res.data[0]["id"],
            "record_date": f"{month_str}-01",
        }).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DRE] Erro ao confirmar inadimplência do pedido {order_id}: {e}")
        raise HTTPException(500, f"Erro ao registrar inadimplência: {str(e)}")



# ============= Pagamentos & Gateways (MP/Stripe) =============

@app.post("/api/financeiro/gateways/sync")
def sync_gateway_data(date: Optional[str] = None):
    """Sincroniza dados do MP e Stripe para uma data específica (default: ontem)."""
    try:
        from datetime import timedelta
        if not date:
            date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        results = []
        errors = []

        # Mercado Pago
        try:
            mp = MercadoPagoClient()
            mp_summary = mp.get_daily_summary(date)
            supabase.table("payment_gateways_history").upsert(mp_summary, on_conflict="date,gateway").execute()
            results.append(mp_summary)
        except Exception as e:
            logger.error(f"[GATEWAY] Erro sincronizando MP: {date}: {e}")
            errors.append({"gateway": "mercadopago", "error": str(e)})

        # Stripe
        try:
            st = StripeClient()
            st_summary = st.get_daily_summary(date)
            supabase.table("payment_gateways_history").upsert(st_summary, on_conflict="date,gateway").execute()
            results.append(st_summary)
        except Exception as e:
            logger.error(f"[GATEWAY] Erro sincronizando Stripe: {date}: {e}")
            errors.append({"gateway": "stripe", "error": str(e)})

        return {"success": True, "date": date, "results": results, "errors": errors}
    except Exception as e:
        logger.error(f"[GATEWAY] Erro geral na sincronização: {e}")
        raise HTTPException(500, f"Erro na sincronização: {str(e)}")

@app.post("/api/financeiro/gateways/sync-month")
def sync_gateway_month(year: int, month: int):
    """Sincroniza todos os dias de um mês completo para MP e Stripe."""
    import calendar
    from datetime import timedelta, date as date_type

    today = datetime.now().date()
    first_day = date_type(year, month, 1)
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = min(date_type(year, month, last_day_num), today - timedelta(days=1))

    mp_results = []
    results = []
    errors = []

    # 1. Sincronizar dia a dia (gross + count para MP, tudo para Stripe)
    current = first_day
    while current <= last_day:
        date_str = current.strftime("%Y-%m-%d")
        try:
            mp = MercadoPagoClient()
            mp_summary = mp.get_daily_summary(date_str)
            mp_results.append(mp_summary)
        except Exception as e:
            logger.error(f"[GATEWAY] Erro MP {date_str}: {e}")
            errors.append({"gateway": "mercadopago", "date": date_str, "error": str(e)})
        try:
            st = StripeClient()
            st_summary = st.get_daily_summary(date_str)
            supabase.table("payment_gateways_history").upsert(st_summary, on_conflict="date,gateway").execute()
            results.append(st_summary)
        except Exception as e:
            logger.error(f"[GATEWAY] Erro Stripe {date_str}: {e}")
            errors.append({"gateway": "stripe", "date": date_str, "error": str(e)})
        current += timedelta(days=1)

    # 2. Salvar resultados do MP no banco
    for r in mp_results:
        supabase.table("payment_gateways_history").upsert(r, on_conflict="date,gateway").execute()
        results.append(r)

    mp_fees_total = round(sum(r["fee_amount"] for r in mp_results), 2)
    return {"success": True, "year": year, "month": month, "days_synced": len(results) // 2, "mp_fees_total": mp_fees_total, "errors": errors}


@app.get("/api/financeiro/gateways/history")
def get_gateway_history(year: int, month: int):
    """Retorna o histórico de sincronização de um mês específico."""
    try:
        res = supabase.rpc("get_gateway_history", {"p_year": year, "p_month": month}).execute()
            
        return res.data or []
    except Exception as e:
        logger.error(f"[GATEWAY] Erro ao buscar histórico: {e}")
        raise HTTPException(500, f"Erro ao buscar histórico: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
