-- migrations/production_processes_enhancements.sql
-- Add process_type, time_source, and measured_at to production_processes

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'labor';

ALTER TABLE production_processes
ADD CONSTRAINT chk_process_type CHECK (process_type IN ('labor', 'wait'));

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS time_source text NOT NULL DEFAULT 'estimated';

ALTER TABLE production_processes
ADD CONSTRAINT chk_time_source CHECK (time_source IN ('measured', 'estimated'));

ALTER TABLE production_processes
ADD COLUMN IF NOT EXISTS measured_at timestamptz NULL;
