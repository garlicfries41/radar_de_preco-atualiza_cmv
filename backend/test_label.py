import sys
import os
import requests

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import supabase

def test_label():
    res = supabase.table("recipes").select("id").limit(1).execute()
    if not res.data:
        print("No recipes")
        return
        
    recipe_id = res.data[0]["id"]
    from main import get_recipe_anvisa_label
    try:
        data = get_recipe_anvisa_label(recipe_id)
        print("Label data keys:", data.keys() if isinstance(data, dict) else "Not a dict")
        print("Nutrients keys:", data.get("nutrients", {}).keys() if isinstance(data, dict) else "none")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_label()
