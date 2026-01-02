-- Fix sync_progress: Add admin-only policies for INSERT, UPDATE, DELETE
CREATE POLICY "Admins can insert sync_progress" 
ON public.sync_progress 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sync_progress" 
ON public.sync_progress 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sync_progress" 
ON public.sync_progress 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix ai_usage_log: Drop overly permissive insert policy and replace with admin-only
DROP POLICY IF EXISTS "Service role can insert AI usage logs" ON public.ai_usage_log;

-- Create new restrictive insert policy (service role always bypasses RLS, so we just need admin check)
CREATE POLICY "Admins can insert AI usage logs" 
ON public.ai_usage_log 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));