# Architecture SOP: Validation & CMV Update

## Goal
Allow user to confirm/edit receipt items, update ingredient prices, and trigger CMV recalculation.

## Input
- Receipt ID (from pending queue).
- User-corrected data: item-to-ingredient mappings, categories.

## Tools Required
- FastAPI endpoint: `PUT /api/receipts/{id}/validate`
- `tools/cmv_calculator.py`: Recipe cost recalculator
- `tools/discord_notifier.py`: Alert sender

## Processing Steps

### 1. User Confirmation
- Receive validated data:
```json
{
  "receipt_id": "uuid",
  "items": [
    {"receipt_item_id": "uuid", "ingredient_id": "uuid", "category": "MERCADO", "price": 5.99}
  ]
}
```

### 2. Update Product Map (Learning)
- For each confirmed mapping:
    - `raw_name` (from receipt_item) -> `ingredient_id` (user-selected).
    - Insert/update `product_map` with confidence = 1.0.

### 3. Update Ingredient Prices
- For each ingredient_id:
    - Update `ingredients.current_price` = new price.
    - Update `ingredients.last_updated` = now().

### 4. CMV Recalculation
- Query all `recipes` that use the updated ingredient(s).
- For each recipe:
    - Sum (`recipe_ingredients.quantity` * `ingredients.current_price`).
    - Update `recipes.current_cost`.
    - Insert into `cmv_history`.

### 5. Price Alert Check
- For each updated ingredient:
    - Compare new_price vs. 30-day average.
    - If delta > 10%: Send Discord alert.

### 6. Finalize Receipt
- Update `receipts.status` = 'verified'.
- Mark all `receipt_items.verified` = True.

## Output
- JSON response:
```json
{
  "success": true,
  "updated_ingredients": 3,
  "recalculated_recipes": 5,
  "alerts_sent": ["Leite subiu 15%!"]
}
```
