-- Add yield_coefficient column to ingredients table
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS yield_coefficient DECIMAL(10,4) DEFAULT 1.0000;

-- Comment: value should be between 0 and 1 (e.g. 0.95 for 95%) or > 0.
-- Using 1.0 as default (100% yield).
