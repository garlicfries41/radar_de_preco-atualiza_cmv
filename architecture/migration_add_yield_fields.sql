-- Migration: Update Recipes Table for Dual CMV Calculation
-- Run this if the recipes table already exists

-- Drop old columns if they exist
ALTER TABLE recipes 
DROP COLUMN IF EXISTS yield_amount,
DROP COLUMN IF EXISTS yield_unit,
DROP COLUMN IF EXISTS unit_net_weight;

-- Add new columns
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS yield_units INTEGER,
ADD COLUMN IF NOT EXISTS total_weight_kg DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS cmv_per_unit DECIMAL(10, 2) GENERATED ALWAYS AS (current_cost / NULLIF(yield_units, 0)) STORED,
ADD COLUMN IF NOT EXISTS cmv_per_kg DECIMAL(10, 2) GENERATED ALWAYS AS (current_cost / NULLIF(total_weight_kg, 0)) STORED;

-- For existing recipes, set default values if needed:
-- UPDATE recipes SET yield_units = 1, total_weight_kg = 1.0 WHERE yield_units IS NULL;
