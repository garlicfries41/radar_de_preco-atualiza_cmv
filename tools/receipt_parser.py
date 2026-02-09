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
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    
    # Exclude common non-item lines
    skip_keywords = ["TOTAL", "SUBTOTAL", "VALOR", "PAGAMENTO", "TROCO", "DINHEIRO", "CARTAO", "CREDITO", "DEBITO", "CPF", "CNPJ", "IMPOSTO", "TRIBUTO", "CAIXA", "OPERADOR", "DATA", "HORA"]
    
    for i, line in enumerate(lines):
        # Skip if too short or matches keywords
        if len(line) < 5 or any(k in line.upper() for k in skip_keywords):
            continue

        # Strategy A: Multi-line Item (common in Brazil)
        # Line i: Code + Name (e.g., "001 2275 MUSS LACTOPAR kg")
        # Line i+1: Qty x Unit Price Total (e.g., "4,086 Kg x 26,90 109,91")
        if i + 1 < len(lines):
            next_line = lines[i+1]
            
            # Pattern: QTY Unit x UnitPrice TotalPrice
            # Ex: "1,000 Un x 15,79 15779" (OCR error on dot) or "4,086 Kg x 26,90 109,91"
            # Regex details:
            #   ^\s*([\d\.,]+)       -> Quantity (Group 1)
            #   \s*(?:Kg|Un|Gf|L|M|PC)?  -> Unit (Optional)
            #   \s*[xX]\s*           -> Separator "x"
            #   ([\d\.,]+)           -> Unit Price (Group 2)
            #   \s+                  -> Space
            #   ([\d\.,]+)           -> Total Price (Group 3)
            
            multi_line_match = re.search(
                r"^\s*([\d\.,]+)\s*(?:Kg|Un|Gf|L|M|PC|SC)?\s*[xX]\s*([\d\.,]+)\s+([\d\.,]+)",
                next_line,
                re.IGNORECASE
            )
            
            if multi_line_match:
                try:
                    qty_str = multi_line_match.group(1).replace(",", ".")
                    unit_price_str = multi_line_match.group(2).replace(",", ".")
                    total_price_str = multi_line_match.group(3).replace(",", ".")
                    
                    # Fix common OCR error where 15,79 becomes 15779
                    if "." not in total_price_str and len(total_price_str) > 3:
                        total_price_str = total_price_str[:-2] + "." + total_price_str[-2:]
                        
                    qty = Decimal(qty_str)
                    total = Decimal(total_price_str)
                    
                    # Clean the name (Line i)
                    # Remove leading codes (digits at start)
                    clean_name = re.sub(r"^[\d\s\.]+", "", line).strip()
                    
                    if len(clean_name) > 3 and total > 0:
                        items.append({
                            "raw_name": clean_name,
                            "quantity": qty,
                            "price": total  # We store total price usually
                        })
                        # Consume next line so we don't process it again
                        lines[i+1] = "" 
                        continue
                except:
                    pass

        # Strategy B: Single-line Item (Fallback)
        # Ex: "LEITE 5.99"
        # Only if NOT processed as multi-line
        match_single = re.search(r"^(.+?)\s+([\d,\.]+)$", line)
        if match_single:
            try:
                name = match_single.group(1).strip()
                price_str = match_single.group(2).replace(",", ".")
                price = Decimal(price_str)
                
                # Loose validation to avoid capturing phone numbers or dates
                if 0.50 <= price <= 5000.00 and not any(char.isdigit() for char in name[-3:]):
                     items.append({
                        "raw_name": name,
                        "quantity": Decimal("1.0"),
                        "price": price
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
