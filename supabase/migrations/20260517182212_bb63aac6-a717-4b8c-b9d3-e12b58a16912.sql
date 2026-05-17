-- Fix fec_manual_mapping: restrict to service_role only (was public)
DROP POLICY IF EXISTS "Service role full access on fec_manual_mapping" ON public.fec_manual_mapping;
CREATE POLICY "Service role full access on fec_manual_mapping"
  ON public.fec_manual_mapping
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Restrict sync_jobs SELECT to admins (only used in admin UI)
DROP POLICY IF EXISTS "Public can read sync_jobs" ON public.sync_jobs;
CREATE POLICY "Admins can read sync_jobs"
  ON public.sync_jobs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Restrict sync_job_runs SELECT to admins (admin ALL policy already provides admin access)
DROP POLICY IF EXISTS "Public can read sync_job_runs" ON public.sync_job_runs;

-- Add explicit admin SELECT policy for fec_sync_state for clarity
CREATE POLICY "Admins can read fec_sync_state"
  ON public.fec_sync_state
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));