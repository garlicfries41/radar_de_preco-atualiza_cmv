#!/usr/bin/env python3
"""
Receipt Parser - Extract structured data from OCR text.
"""

import re
from typing import List, Dict, Optional
from decimal import Decimal


def clean_text(text: str) -> str:
    """Remove extra whitespace and normalize."""
    return " ".join(text.split())


def extract_market_name(text: str) -> Optional[str]:
    """Extract market/store name (usually first few lines)."""
    lines = text.strip().split("\n")
    if lines:
        # Usually the first non-empty line
        for line in lines[:5]:
            line = line.strip()
            if len(line) > 3 and not line.replace(".", "").isdigit():
                return line
    return None


def extract_total_amount(text: str) -> Optional[Decimal]:
    """Extract total value from receipt."""
    # Common patterns: "TOTAL", "VALOR TOTAL", "R$"
    patterns = [
        r"TOTAL[\s:]*R?\$?\s*([\d,\.]+)",
        r"VALOR\s+TOTAL[\s:]*R?\$?\s*([\d,\.]+)",
        r"R\$\s*([\d,\.]+)\s*TOTAL",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value_str = match.group(1).replace(".", "").replace(",", ".")
            try:
                return Decimal(value_str)
            except:
                pass
    
    return None


def extract_items(text: str) -> List[Dict]:
    """
    Extract line items from receipt.
    
    Common patterns:
    - ITEM_NAME QTD PRICE
    - ITEM_NAME PRICE
    - CODE ITEM_NAME QTD UNIT_PRICE TOTAL
    
    Returns:
        List of dicts with {raw_name, quantity, price}
    """
    items = []
    lines = text.split("\n")
    
    for line in lines:
        line = line.strip()
        if len(line) < 5:
            continue
        
        # Pattern 1: Name ... Price (more generic)
        # Example: "LEITE INTEGRAL 1L    5.99"
        match = re.search(r"^(.+?)\s+([\d,\.]+)$", line)
        if match:
            name = match.group(1).strip()
            price_str = match.group(2).replace(",", ".")
            
            # Validate it looks like a price (not a code)
            try:
                price = Decimal(price_str)
                if 0.10 <= price <= 9999.99:  # Reasonable range
                    items.append({
                        "raw_name": name,
                        "quantity": Decimal("1.0"),
                        "price": price
                    })
            except:
                pass
        
        # Pattern 2: Name QTD x UNIT_PRICE = TOTAL
        # Example: "ARROZ 2 x 10.50 = 21.00"
        match = re.search(
            r"^(.+?)\s+(\d+(?:[,\.]\d+)?)\s*[xX]\s*([\d,\.]+)\s*=?\s*([\d,\.]+)",
            line
        )
        if match:
            name = match.group(1).strip()
            qty_str = match.group(2).replace(",", ".")
            price_str = match.group(4).replace(",", ".")
            
            try:
                items.append({
                    "raw_name": name,
                    "quantity": Decimal(qty_str),
                    "price": Decimal(price_str)
                })
            except:
                pass
    
    return items


def parse_receipt(text: str) -> Dict:
    """
    Main parser function.
    
    Returns:
        {
            "market_name": str,
            "total_amount": Decimal,
            "items": [{"raw_name": str, "quantity": Decimal, "price": Decimal}]
        }
    """
    return {
        "market_name": extract_market_name(text),
        "total_amount": extract_total_amount(text),
        "items": extract_items(text)
    }


if __name__ == "__main__":
    # Test parser
    sample_text = """
    SUPERMERCADO EXEMPLO LTDA
    RUA TESTE, 123
    
    LEITE INTEGRAL 1L    5.99
    ARROZ TIPO 1 5KG     28.50
    FEIJAO PRETO 1KG     7.80
    CAFE 500G            12.00
    
    TOTAL: R$ 54.29
    """
    
    result = parse_receipt(sample_text)
    print("Market:", result["market_name"])
    print("Total:", result["total_amount"])
    print("Items found:", len(result["items"]))
    for item in result["items"]:
        print(f"  - {item['raw_name']}: R$ {item['price']}")
