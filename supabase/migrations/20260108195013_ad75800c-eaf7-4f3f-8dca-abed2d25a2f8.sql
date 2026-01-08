
-- Fix overly permissive INSERT policies on sent_notifications and user_activity_log
-- These tables should only be writable by service role (edge functions) and triggers

-- Drop the existing overly permissive INSERT policies
DROP POLICY IF EXISTS "Service role can insert sent_notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Service role can insert activity" ON public.user_activity_log;

-- Create new restrictive INSERT policies that ONLY allow service role
-- Regular authenticated users should NOT be able to insert into these tables directly
-- All inserts should come from edge functions (using service role) or database triggers

CREATE POLICY "Only service role can insert notifications"
ON public.sent_notifications
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Only service role can insert activity logs"
ON public.user_activity_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add comments explaining the security model
COMMENT ON POLICY "Only service role can insert notifications" ON public.sent_notifications IS 
'Restricts INSERT to service_role only. Notifications are created by edge functions, not directly by users.';

COMMENT ON POLICY "Only service role can insert activity logs" ON public.user_activity_log IS 
'Restricts INSERT to service_role only. Activity logs are created by triggers and edge functions, not directly by users.';
