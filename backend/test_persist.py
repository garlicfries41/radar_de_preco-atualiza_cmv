import sys
import os
import json
import uuid

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import supabase

def test_insert_category():
    print("Checking if recipe_categories has data...")
    cats = supabase.table("recipe_categories").select("*").limit(3).execute()
    print("Categories:", cats.data)
    
    if not cats.data:
        print("No categories found in table. That's why UI might not be able to select it properly.")
        return
        
    cat_id = cats.data[0]["id"]
    print(f"Testing insert for category {cat_id}")
    
    test_recipe = {
        "name": "TEST RECIPE CAT SAVING",
        "yield_units": 10,
        "labor_minutes": 10,
        "labor_cost": 0,
        "ingredients_cost": 0,
        "packaging_cost": 0,
        "current_cost": 0,
        "total_weight_kg": 1,
        "category_id": cat_id,
        "production_unit": "KG",
    }
    
    res = supabase.table("recipes").insert(test_recipe).execute()
    print("Insert result:", res.data[0])
    
    inserted_id = res.data[0]["id"]
    res_fetch = supabase.table("recipes").select("*").eq("id", inserted_id).single().execute()
    print("Fetched back:", res_fetch.data)
    
    # Clean up
    supabase.table("recipes").delete().eq("id", inserted_id).execute()

if __name__ == "__main__":
    test_insert_category()
