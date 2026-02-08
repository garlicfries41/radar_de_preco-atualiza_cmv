#!/usr/bin/env python3
"""
Test script to upload receipt image to the API.
"""

import requests
import sys

# API endpoint
API_URL = "http://127.0.0.1:8000/api/receipts/upload"

def upload_receipt(image_path):
    """Upload receipt image to the API."""
    print(f"📤 Uploading: {image_path}")
    
    try:
        with open(image_path, 'rb') as f:
            files = {'file': (image_path, f, 'image/png')}
            response = requests.post(API_URL, files=files, timeout=30)
        
        print(f"\n📊 Status Code: {response.status_code}\n")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Upload successful!")
            print(f"\n📋 Receipt ID: {data['receipt_id']}")
            print(f"🏪 Market: {data.get('market_name', 'N/A')}")
            print(f"💰 Total: R$ {data.get('total_amount', 0):.2f}")
            print(f"\n📦 Items detected: {len(data['items'])}")
            
            for i, item in enumerate(data['items'], 1):
                print(f"\n  {i}. {item['raw_name']}")
                print(f"     Price: R$ {item['parsed_price']:.2f}")
                print(f"     Qty: {item['quantity']}")
                if item.get('suggested_ingredient'):
                    print(f"     ✨ Suggested: {item['suggested_ingredient']['name']} ({item['suggested_ingredient']['category']})")
                else:
                    print(f"     ⚠️  No match found")
        else:
            print(f"❌ Error: {response.text}")
            
    except FileNotFoundError:
        print(f"❌ File not found: {image_path}")
    except Exception as e:
        print(f"❌ Upload failed: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        upload_receipt(sys.argv[1])
    else:
        print("Usage: python test_upload.py <image_path>")
