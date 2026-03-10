CREATE TABLE IF NOT EXISTS recipe_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES production_processes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    time_per_unit_minutes DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recipe_processes_recipe ON recipe_processes(recipe_id);
