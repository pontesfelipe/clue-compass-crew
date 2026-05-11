
-- Restrict fec_sync_state writes/reads to service role only (drop overly permissive policy)
DROP POLICY IF EXISTS "Service role full access on fec_sync_state" ON public.fec_sync_state;
CREATE POLICY "Service role manages fec_sync_state"
  ON public.fec_sync_state
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Restrict sync_state SELECT to admins only (remove public read)
DROP POLICY IF EXISTS "Public can read sync_state" ON public.sync_state;
CREATE POLICY "Admins can read sync_state"
  ON public.sync_state
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enforce security_invoker on view so RLS uses querying user, not view owner
ALTER VIEW public.fec_sync_completeness SET (security_invoker = on);
