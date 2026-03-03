import sys
import os
import json

# Add backend to path so we can import from main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import supabase

def check_schema():
    print("Checking recipes columns...")
    # Fetch a single row to see its keys
    res = supabase.table("recipes").select("*").limit(1).execute()
    if res.data:
        print(f"Columns in recipes: {list(res.data[0].keys())}")
    else:
        # If table is empty, we can try to fetch table info another way or just insert and look at error
        print("No rows in recipes table.")

if __name__ == "__main__":
    check_schema()
