import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import supabase

def check_data():
    res = supabase.table("recipes").select("id, name, category_id, product_id").order("last_calculated", desc=True).limit(5).execute()
    for row in res.data:
        print(row)

if __name__ == "__main__":
    check_data()
