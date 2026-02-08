# ♊ gemini.md - Project Constitution

**Status:** Phase 1 (Blueprint) - Schema Defined
**Project:** Radar de Preço_Atualiza CMV
**Framework:** B.L.A.S.T. / A.N.T.

## 1. Data Schemas (JSON/Supabase)

### `ingredients` (Master Table)
*Represents the normalized ingredient used in recipes.*
```json
{
  "id": "uuid",
  "name": "string (Unique)",
  "category": "string (Mercado, Limpeza, etc)",
  "current_price": "float",
  "unit": "string (kg, L, un)",
  "last_updated": "timestamp"
}
```

### `product_map` (The "Brain")
*Maps raw OCR names to Ingredients. Allows the app to "learn".*
```json
{
  "id": "uuid",
  "raw_name": "string (e.g., 'LEITE INTEGRAL 1L ITAMBE')",
  "ingredient_id": "uuid (FK -> ingredients.id)",
  "confidence": "float"
}
```

### `receipts`
```json
{
  "id": "uuid",
  "created_at": "timestamp",
  "market_name": "string",
  "total_amount": "float",
  "image_url": "string",
  "status": "enum ('pending_validation', 'verified', 'rejected')"
}
```

### `receipt_items` (Staging/History)
```json
{
  "id": "uuid",
  "receipt_id": "uuid (FK)",
  "raw_name": "string",
  "parsed_price": "float",
  "quantity": "float",
  "matched_ingredient_id": "uuid (FK -> ingredients - Nullable until validation)",
  "category_suggestion": "string"
}
```

### `recipes` & `recipe_ingredients` (CMV)
*Recipe tables with dual CMV calculation (per unit + per kg).*
```json
{
  "recipes": { 
    "id": "uuid", 
    "name": "string", 
    "current_cost": "float (custo total da receita)",
    "yield_units": "integer (quantas unidades produz, ex: 10)",
    "total_weight_kg": "float (peso total produzido em kg, ex: 12.5)",
    "cmv_per_unit": "float (calculado: current_cost / yield_units)",
    "cmv_per_kg": "float (calculado: current_cost / total_weight_kg)"
  },
  "recipe_ingredients": { 
    "recipe_id": "uuid", 
    "ingredient_id": "uuid", 
    "quantity": "float" 
  }
}
```

**Exemplo:**
- Lasanha: 10 unidades, 12kg total → CMV: R$5/un, R$4.17/kg
- Ravioli: 50 unidades, 5kg total → CMV: R$1.60/un, R$16/kg

## 2. Behavioral Rules
- **Batch Upload First:** Users can upload MULTIPLE receipts at once. All receipts stay in `pending_validation` queue. Validation happens later, at user's convenience.
- **Mobile-First Design:** Interface MUST be fully responsive. Primary use case is photographing receipts with phone camera.
- **Recipe Management:** A separate `/admin` section within the same app allows CRUD operations on Recipes and Ingredients. CMV is auto-calculated on save.
- **Validation First:** All scanned receipts enter `pending_validation` state. User MUST confirm/edit items before `ingredients` prices are updated.
- **De-Duplication:** During validation, UI must offer autocomplete for existing `ingredients`.
- **Isolation:** NEVER touch tables outside this schema without explicit permission.
- **Learning:** When user links a `raw_name` to an `ingredient`, save to `product_map`.

## 3. Architecture Invariants
- **Database:** Supabase (PostgreSQL).
- **Backend (OCR/Logic):** Python (FastAPI) + Tesseract. Hosted on **VPS** (Docker).
- **Frontend:** React (Vite) + TailwindCSS - **Mobile-First Responsive**. Hosted on **Vercel**.
- **Design:** HelloBonsai Style (Clean, Green, Minimal) optimized for mobile screens.
- **Notificações:** Discord Webhook via Backend.
