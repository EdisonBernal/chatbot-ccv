-- Migration: Add routing columns to chatbot_steps for branching flows
-- goto_step_name: default next step (overrides sequential step_number order)
-- keyword_routes: JSON mapping of keyword text → target step name for branching

ALTER TABLE chatbot_steps ADD COLUMN IF NOT EXISTS goto_step_name TEXT DEFAULT NULL;
ALTER TABLE chatbot_steps ADD COLUMN IF NOT EXISTS keyword_routes JSONB DEFAULT NULL;
