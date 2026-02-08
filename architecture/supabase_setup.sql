-- 🏗️ Radar de Preço & CMV - Database Schema
-- Author: Antigravity System Pilot
-- Description: Core tables for Receipt Parsing, Ingredient Management, and CMV Analysis.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ingredients (Master Table)
-- Represents the normalized ingredient used in recipes.
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('MERCADO', 'LIMPEZA', 'HORTIFRUTI', 'ACOUGUE', 'EMBALAGEM', 'OUTROS')),
    current_price DECIMAL(10, 2) DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT 'UN', -- kg, L, un, pct
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Receipts (Headers)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    market_name TEXT,
    total_amount DECIMAL(10, 2),
    image_url TEXT,
    status TEXT DEFAULT 'pending_validation' CHECK (status IN ('pending_validation', 'verified', 'rejected'))
);

-- 3. Product Map (The Learning Brain)
-- Maps raw OCR names to Normalized Ingredients.
CREATE TABLE IF NOT EXISTS product_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_name TEXT NOT NULL,
    ingredient_id UUID REFERENCES ingredients(id),
    confidence DECIMAL(5, 4) DEFAULT 1.0, -- 0.0 to 1.0
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(raw_name, ingredient_id)
);

-- 4. Receipt Items (Staging & History)
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
    raw_name TEXT NOT NULL,
    parsed_price DECIMAL(10, 2),
    quantity DECIMAL(10, 3) DEFAULT 1.0,
    matched_ingredient_id UUID REFERENCES ingredients(id), -- Null until validated
    category_suggestion TEXT,
    verified BOOLEAN DEFAULT FALSE
);

-- 5. Recipes
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    current_cost DECIMAL(10, 2) DEFAULT 0.00, -- Total recipe cost
    yield_units INTEGER NOT NULL, -- How many units produced (e.g., 10 lasagnas)
    total_weight_kg DECIMAL(10, 3) NOT NULL, -- Total weight in kg (e.g., 12.5 kg)
    cmv_per_unit DECIMAL(10, 2) GENERATED ALWAYS AS (current_cost / NULLIF(yield_units, 0)) STORED,
    cmv_per_kg DECIMAL(10, 2) GENERATED ALWAYS AS (current_cost / NULLIF(total_weight_kg, 0)) STORED,
    last_calculated TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Recipe Ingredients (Join Table)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity DECIMAL(10, 4) NOT NULL -- Quantity of ingredient used in recipe
);

-- 7. CMV History (Analytics)
CREATE TABLE IF NOT EXISTS cmv_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    cost DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_product_map_raw_name ON product_map(raw_name);
CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- Optional: RLS Policies (Row Level Security)
-- For now, enabling public access for simplicity in MVP phase, but recommended to lock down later.
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmv_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow full access for execution (Adjust based on actual Auth needs)
CREATE POLICY "Enable all access for authenticated users" ON ingredients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON receipts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON product_map FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON receipt_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON recipes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON recipe_ingredients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON cmv_history FOR ALL USING (auth.role() = 'authenticated');
