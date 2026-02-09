# Architecture SOP: Recipe Management (CMV)

## Goal
Manage recipes, link ingredients, and automatically calculate Cost of Goods Sold (CMV) per unit and per kg.

## Input
- Recipe Name
- Yield Data (Units Produced + Total Weight Kg)
- Ingredients List (Ingredient ID + Quantity)

## Tools Required
- FastAPI endpoints: `POST /api/recipes`, `PUT /api/recipes/{id}`, `GET /api/recipes`
- `tools/cmv_calculator.py`: Logic shared with Validation flow.

## Processing Steps

### 1. Recipe Definition
- **User Action**: Enters recipe details via Admin UI.
- **Input Example**:
  ```json
  {
    "name": "Massa de Pizza",
    "yield_units": 10,
    "total_weight_kg": 2.5,
    "ingredients": [
      {"ingredient_id": "uuid-farinha", "quantity": 1.5}, // kg
      {"ingredient_id": "uuid-agua", "quantity": 1.0}     // L/kg
    ]
  }
  ```

### 2. Cost Calculation (Live)
- **Backend Logic**:
  1. Retrieve `current_price` for each ingredient.
  2. Calculate `component_cost` = `price` * `quantity`.
  3. `total_cost` = Sum(component_cost).
  4. `cmv_per_unit` = `total_cost` / `yield_units`.
  5. `cmv_per_kg` = `total_cost` / `total_weight_kg`.

### 3. Validation Rules
- **Yield Validation**: `yield_units` MUST be > 0.
- **Ingredient Check**: All ingredients MUST exist in DB.
- **Unit Consistency**: Warn if ingredient is "UN" but recipe uses fractional quantity (unless allowed).

### 4. Storage
- Insert/Update `recipes` table.
- Atomic commit for `recipe_ingredients` (delete old, insert new).
- Log generic "Recipe Created/Updated" event.

## Output
- JSON Check:
  ```json
  {
    "id": "uuid",
    "name": "Massa de Pizza",
    "current_cost": 15.50,
    "cmv_per_unit": 1.55,
    "cmv_per_kg": 6.20
  }
  ```
