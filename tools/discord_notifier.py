#!/usr/bin/env python3
"""
Discord Notifier - Send alerts to Discord via webhook.
"""

import os
import requests
from typing import Optional
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")


def send_price_alert(
    ingredient_name: str,
    old_price: Decimal,
    new_price: Decimal,
    change_percent: Decimal
) -> bool:
    """
    Send price change alert to Discord.
    
    Args:
        ingredient_name: Name of the ingredient
        old_price: Previous price
        new_price: New price
        change_percent: Percentage change
        
    Returns:
        True if sent successfully
    """
    if not DISCORD_WEBHOOK_URL:
        print("⚠️ DISCORD_WEBHOOK_URL not configured")
        return False
    
    # Determine emoji based on change
    emoji = "🚨" if change_percent > 0 else "✅"
    color = 15158332 if change_percent > 0 else 3066993  # Red or Green
    
    payload = {
        "embeds": [{
            "title": f"{emoji} Alerta de Preço: {ingredient_name}",
            "description": f"O preço mudou **{abs(change_percent):.1f}%**",
            "color": color,
            "fields": [
                {
                    "name": "Preço Anterior",
                    "value": f"R$ {old_price:.2f}",
                    "inline": True
                },
                {
                    "name": "Novo Preço",
                    "value": f"R$ {new_price:.2f}",
                    "inline": True
                },
                {
                    "name": "Variação",
                    "value": f"{'+' if change_percent > 0 else ''}{change_percent:.1f}%",
                    "inline": True
                }
            ]
        }]
    }
    
    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        return response.status_code == 204
    except Exception as e:
        print(f"Failed to send Discord alert: {e}")
        return False


def send_cmv_update(
    recipe_name: str,
    old_cmv: Decimal,
    new_cmv: Decimal,
    affected_ingredients: list
) -> bool:
    """
    Send CMV update notification.
    
    Args:
        recipe_name: Name of the recipe
        old_cmv: Previous CMV per unit
        new_cmv: New CMV per unit
        affected_ingredients: List of ingredient names that changed
        
    Returns:
        True if sent successfully
    """
    if not DISCORD_WEBHOOK_URL:
        return False
    
    change_percent = ((new_cmv - old_cmv) / old_cmv * 100) if old_cmv > 0 else 0
    emoji = "📊"
    
    ingredients_text = ", ".join(affected_ingredients[:3])
    if len(affected_ingredients) > 3:
        ingredients_text += f" +{len(affected_ingredients) - 3} outros"
    
    payload = {
        "embeds": [{
            "title": f"{emoji} CMV Atualizado: {recipe_name}",
            "description": f"Ingredientes afetados: {ingredients_text}",
            "color": 5793266,  # Purple
            "fields": [
                {
                    "name": "CMV Anterior",
                    "value": f"R$ {old_cmv:.2f}/un",
                    "inline": True
                },
                {
                    "name": "Novo CMV",
                    "value": f"R$ {new_cmv:.2f}/un",
                    "inline": True
                },
                {
                    "name": "Mudança",
                    "value": f"{'+' if change_percent > 0 else ''}{change_percent:.1f}%",
                    "inline": True
                }
            ]
        }]
    }
    
    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload)
        return response.status_code == 204
    except Exception as e:
        print(f"Failed to send Discord alert: {e}")
        return False


if __name__ == "__main__":
    # Test notification
    send_price_alert(
        ingredient_name="Leite Integral",
        old_price=Decimal("5.00"),
        new_price=Decimal("5.75"),
        change_percent=Decimal("15.0")
    )
