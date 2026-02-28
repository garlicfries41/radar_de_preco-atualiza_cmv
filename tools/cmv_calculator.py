#!/usr/bin/env python3
"""
CMV Calculator - Recalculate recipe costs based on ingredient prices.
"""

from typing import List, Dict
from decimal import Decimal
from supabase import Client


async def recalculate_recipe_cost(
    recipe_id: str,
    supabase: Client
) -> Dict:
    """
    Recalculate cost of a single recipe.
    
    Steps:
    1. Fetch all ingredients for the recipe
    2. Sum (quantity * current_price) for each ingredient
    3. Update recipe.current_cost
    4. Log to cmv_history
    
    Returns:
        {
            "recipe_id": str,
            "new_cost": Decimal,
            "cmv_per_unit": Decimal,
            "cmv_per_kg": Decimal
        }
    """
    # Get recipe details
    recipe_response = supabase.table("recipes").select("*").eq("id", recipe_id).execute()
    if not recipe_response.data:
        raise ValueError(f"Recipe {recipe_id} not found")
    
    recipe = recipe_response.data[0]
    
    # Get recipe ingredients with current prices, yields and categories
    ingredients_response = supabase.table("recipe_ingredients") \
        .select("ingredient_id, quantity, ingredients(current_price, yield_coefficient, category)") \
        .eq("recipe_id", recipe_id) \
        .execute()
    
    # Calculate totals
    total_batch_ingredients_cost = Decimal("0.00")
    total_batch_packaging_cost = Decimal("0.00")
    total_weight = Decimal("0.00")
    
    for item in ingredients_response.data:
        qty = Decimal(str(item["quantity"]))
        
        # Get ingredient data with fallbacks
        ing_data = item.get("ingredients") or {}
        price = Decimal(str(ing_data.get("current_price", 0)))
        yield_coeff = Decimal(str(ing_data.get("yield_coefficient", 1)))
        category = ing_data.get("category", "")
        
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
            
    # Labor cost remains the same as previously saved, as it's modified within the UI based on rate
    labor_cost = Decimal(str(recipe.get("labor_cost", 0)))
    total_cost = total_batch_ingredients_cost + total_batch_packaging_cost + labor_cost
    
    # Update recipe
    update_response = supabase.table("recipes") \
        .update({
            "current_cost": float(total_cost),
            "ingredients_cost": float(total_batch_ingredients_cost),
            "packaging_cost": float(total_batch_packaging_cost),
            # total_weight_kg is not updated in case yield changed, though technically it might if yield is dynamically tracking
        }) \
        .eq("id", recipe_id) \
        .execute()
    
    updated_recipe = update_response.data[0]
    
    # Log to history
    # To log labor_rate_applied, we approximate it from cost and minutes if minutes > 0
    labor_minutes = Decimal(str(recipe.get("labor_minutes", 0)))
    labor_rate_applied = Decimal("0.00")
    if labor_minutes > 0:
        labor_rate_applied = (labor_cost / (labor_minutes / Decimal("60")))
        
    supabase.table("cmv_history").insert({
        "recipe_id": recipe_id,
        "product_id": recipe.get("product_id"),
        "cost": float(total_cost),
        "ingredients_cost": float(total_batch_ingredients_cost),
        "packaging_cost": float(total_batch_packaging_cost),
        "labor_cost": float(labor_cost),
        "labor_rate_applied": float(labor_rate_applied)
    }).execute()
    
    # CMV values are auto-calculated in DB, fetch them
    return {
        "recipe_id": recipe_id,
        "new_cost": total_cost,
        "cmv_per_unit": Decimal(str(updated_recipe.get("cmv_per_unit", 0))),
        "cmv_per_kg": Decimal(str(updated_recipe.get("cmv_per_kg", 0)))
    }


async def recalculate_affected_recipes(
    ingredient_ids: List[str],
    supabase: Client
) -> List[Dict]:
    """
    Find and recalculate all recipes that use the given ingredients.
    
    Args:
        ingredient_ids: List of ingredient IDs that were updated
        supabase: Supabase client
        
    Returns:
        List of recalculation results
    """
    # Find affected recipes
    recipes_response = supabase.table("recipe_ingredients") \
        .select("recipe_id") \
        .in_("ingredient_id", ingredient_ids) \
        .execute()
    
    # Get unique recipe IDs
    recipe_ids = list(set([r["recipe_id"] for r in recipes_response.data]))
    
    # Recalculate each
    results = []
    for recipe_id in recipe_ids:
        result = await recalculate_recipe_cost(recipe_id, supabase)
        results.append(result)
    
    return results


def calculate_cmv_change_percentage(
    old_cost: Decimal,
    new_cost: Decimal
) -> Decimal:
    """Calculate percentage change in CMV."""
    if old_cost == 0:
        return Decimal("0")
    
    change = ((new_cost - old_cost) / old_cost) * 100
    return change.quantize(Decimal("0.01"))
