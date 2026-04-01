-- Fix RLS for chatbot_steps and related tables
-- Allow users present in public.users with role = 'admin' to manage steps/actions/conditions

BEGIN;

ALTER TABLE IF EXISTS public.chatbot_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chatbot_step_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chatbot_step_conditions ENABLE ROW LEVEL SECURITY;

-- Drop restrictive admin-only policies if present
DROP POLICY IF EXISTS "admins_manage_chatbot_steps" ON public.chatbot_steps;
DROP POLICY IF EXISTS "admins_manage_chatbot_actions" ON public.chatbot_step_actions;
DROP POLICY IF EXISTS "admins_manage_chatbot_conditions" ON public.chatbot_step_conditions;

-- Simple admin-only policies using JWT claim `role`.
CREATE POLICY "admins_manage_chatbot_steps" ON public.chatbot_steps
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admins_manage_chatbot_actions" ON public.chatbot_step_actions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admins_manage_chatbot_conditions" ON public.chatbot_step_conditions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

COMMIT;

-- Note: Run this migration in Supabase SQL editor. Ensure the `public.users` table
-- contains rows with `auth_id` matching auth.uid() and `role = 'admin'` for admin users.
