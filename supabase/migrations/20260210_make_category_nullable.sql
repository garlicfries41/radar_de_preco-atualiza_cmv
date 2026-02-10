-- Make category column nullable in ingredients table
-- This allows ingredients to be created without a category initially

ALTER TABLE ingredients 
ALTER COLUMN category DROP NOT NULL;

-- Update existing NULL values to a default if needed (optional)
-- UPDATE ingredients SET category = 'Uncategorized' WHERE category IS NULL;
