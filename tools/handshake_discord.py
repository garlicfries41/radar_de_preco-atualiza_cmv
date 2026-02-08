#!/usr/bin/env python3
"""
Discord Handshake - Webhook Verification
Tests Discord webhook connectivity.
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

def verify_webhook() -> bool:
    """Test Discord webhook."""
    print("🔗 Testing Discord Webhook...")
    
    if not DISCORD_WEBHOOK_URL:
        print("❌ ERROR: Missing DISCORD_WEBHOOK_URL in .env")
        return False
    
    try:
        payload = {
            "content": "🟢 **System Pilot Online** - Radar de Preço connected successfully!",
            "embeds": [{
                "title": "Connection Test",
                "description": "Phase 2: Link verification complete.",
                "color": 5763719  # Green color
            }]
        }
        
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        
        if response.status_code == 204:
            print("✅ Discord webhook test message sent successfully!")
            print("   Check your Discord channel for the test message.")
            return True
        else:
            print(f"❌ Webhook failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Discord webhook test failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = verify_webhook()
    sys.exit(0 if success else 1)
