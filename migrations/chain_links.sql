-- migrations/chain_links.sql
-- Add chain_group_id to recipe_processes and production_schedule

ALTER TABLE recipe_processes
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;

ALTER TABLE production_schedule
ADD COLUMN IF NOT EXISTS chain_group_id uuid NULL;
