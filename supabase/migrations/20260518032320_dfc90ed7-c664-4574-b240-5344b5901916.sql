
DROP POLICY IF EXISTS "Public read access for member_data_completeness" ON public.member_data_completeness;
DROP POLICY IF EXISTS "Public can read api_sync_runs" ON public.api_sync_runs;
DROP POLICY IF EXISTS "Public read access for data_quality_metrics" ON public.data_quality_metrics;

CREATE POLICY "Admins can read member_data_completeness"
ON public.member_data_completeness FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read api_sync_runs"
ON public.api_sync_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read data_quality_metrics"
ON public.data_quality_metrics FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
