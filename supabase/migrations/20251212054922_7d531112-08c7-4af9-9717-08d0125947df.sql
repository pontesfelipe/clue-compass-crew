-- Fix security definer view by setting it to security invoker
ALTER VIEW public.sync_health SET (security_invoker = on);

-- Create a policy for public to read sync_health underlying tables
-- (sync_progress already has public read, sync_jobs already has public read)