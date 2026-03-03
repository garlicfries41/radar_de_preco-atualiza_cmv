import sys
import os
import requests

# We need an existing recipe to update
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import supabase

def test_api():
    # 1. Get an existing recipe
    res = supabase.table("recipes").select("*").limit(1).execute()
    if not res.data:
        print("No recipes")
        return
    recipe = res.data[0]
    recipe_id = recipe["id"]
    
    # 2. Get an existing category
    cats = supabase.table("recipe_categories").select("*").limit(1).execute()
    if not cats.data:
        print("No categories")
        return
    cat_id = cats.data[0]["id"]
    
    # 3. Make HTTP PUT to the local API
    payload = {
        "name": recipe["name"],
        "yield_units": recipe.get("yield_units") or 1,
        "labor_minutes": recipe.get("labor_minutes") or 0,
        "labor_cost": recipe.get("labor_cost") or 0,
        "sku": recipe.get("sku"),
        "category_id": cat_id,  # The crucial part
        "product_id": recipe.get("product_id"),
        "is_pre_preparo": getattr(recipe, 'is_pre_preparo', False),
        "production_unit": recipe.get("production_unit") or "KG",
        "net_weight": recipe.get("net_weight"),
        "update_category_default": False,
        "cascade_update": False,
        "ingredients": [] # Just empty for test
    }
    
    try:
        url = f"http://localhost:8000/api/recipes/{recipe_id}"
        print(f"Sending PUT to {url} with category_id {cat_id}")
        r = requests.put(url, json=payload)
        print("API Response:", r.status_code, r.text)
        
        # 4. Verify in DB directly
        verify = supabase.table("recipes").select("id, category_id").eq("id", recipe_id).single().execute()
        print("DB state after API call:", verify.data)
        
    except Exception as e:
        print("Failed to run local HTTP test:", e)

if __name__ == "__main__":
    test_api()
