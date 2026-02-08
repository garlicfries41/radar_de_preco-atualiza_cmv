# Architecture SOP: Backend OCR & Upload Flow

## Goal
Process receipt images via OCR, extract structured data, and stage for user validation.

## Input
- Image file (JPEG, PNG, PDF) from mobile camera or file upload.
- Max size: 10MB.

## Tools Required
- `tools/ocr_processor.py`: Tesseract wrapper
- `tools/receipt_parser.py`: Text-to-JSON parser
- FastAPI endpoint: `POST /api/receipts/upload`

## Processing Steps

### 1. Image Reception
- Validate file type and size.
- Save to `.tmp/uploads/{uuid}.jpg`.

### 2. OCR Execution
- Preprocess image (grayscale, contrast).
- Run Tesseract OCR.
- Output: Raw text string.

### 3. Text Parsing
- Extract market name (first line, usually).
- Extract items using regex: `ITEM_NAME ... QTD ... PRICE`.
- Extract total amount.

### 4. Fuzzy Matching (Learning)
- For each extracted item, query `product_map` for similar `raw_name`.
- If match found (confidence > 0.8), suggest the linked `ingredient_id`.

### 5. Database Staging
- Insert into `receipts` table (status: pending_validation).
- Insert each item into `receipt_items` (with `matched_ingredient_id` if suggested).

## Output
- JSON response:
```json
{
  "receipt_id": "uuid",
  "market_name": "string",
  "total": float,
  "items": [
    {"raw_name": "LEITE INTEGRAL", "price": 5.99, "suggested_ingredient": {"id": "uuid", "name": "Leite"}}
  ]
}
```

## Edge Cases
- **OCR Failure:** Return error, prompt user to retake photo.
- **No Items Detected:** Warn user, allow manual entry.
- **Duplicate Upload:** Check if image hash already exists.
