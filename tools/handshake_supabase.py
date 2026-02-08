#!/usr/bin/env python3
"""
Supabase Handshake - Connection Verification
Tests database connectivity and verifies schema exists.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

def verify_connection() -> bool:
    """Test connection to Supabase."""
    print("🔗 Testing Supabase Connection...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env")
        return False
    
    try:
        # Initialize client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"✅ Connected to: {SUPABASE_URL}")
        
        # Test query - Check if ingredients table exists
        response = supabase.table("ingredients").select("*").limit(1).execute()
        print(f"✅ Table 'ingredients' exists. Rows: {len(response.data)}")
        
        # Check other core tables
        tables = ["receipts", "receipt_items", "product_map", "recipes"]
        for table in tables:
            response = supabase.table(table).select("*").limit(1).execute()
            print(f"✅ Table '{table}' exists. Rows: {len(response.data)}")
        
        print("\n🎉 All Supabase connections verified successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = verify_connection()
    sys.exit(0 if success else 1)
