-- Fix overly permissive RLS policies that use WITH CHECK (true)

-- Drop the existing permissive policies
DROP POLICY IF EXISTS "Service role can insert sent_notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Service role can insert activity" ON public.user_activity_log;

-- Recreate with proper service role check
-- For sent_notifications: Only allow inserts from service role (edge functions) OR authenticated users for their own records
CREATE POLICY "Service role can insert sent_notifications" 
ON public.sent_notifications 
FOR INSERT 
TO authenticated, service_role
WITH CHECK (
  -- Service role can insert any notification
  (auth.role() = 'service_role')
  OR
  -- Users can only insert their own notifications (edge case, primarily service role)
  (auth.uid() = user_id)
);

-- For user_activity_log: Only allow inserts from service role (triggers/edge functions) OR users inserting their own activity
CREATE POLICY "Service role can insert activity" 
ON public.user_activity_log 
FOR INSERT 
TO authenticated, service_role
WITH CHECK (
  -- Service role can insert any activity log (for triggers and edge functions)
  (auth.role() = 'service_role')
  OR
  -- Users can insert their own activity (unlikely but possible)
  (auth.uid() = user_id)
);