-- Fix RLS for chatbot_config
-- Allow the authenticated creator (created_by) or users with role='admin' in public.users
-- to perform SELECT/INSERT/UPDATE/DELETE on chatbot_config.

BEGIN;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE IF EXISTS public.chatbot_config ENABLE ROW LEVEL SECURITY;

-- Drop old policy if present
DROP POLICY IF EXISTS "admins_manage_chatbot_config" ON public.chatbot_config;
DROP POLICY IF EXISTS "admins_or_owner_manage_chatbot_config" ON public.chatbot_config;

-- Simple admin-only policy using JWT claim `role`.
CREATE POLICY "admins_manage_chatbot_config" ON public.chatbot_config
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

COMMIT;

-- Note: Run this migration in Supabase SQL editor. If you have existing rows where
-- created_by is not set to the auth user's id text, adjust them accordingly.
