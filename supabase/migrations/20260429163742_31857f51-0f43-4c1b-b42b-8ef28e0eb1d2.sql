CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint text,
  retry_after_seconds integer,
  hit_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_provider_hit_at
  ON public.api_rate_limits (provider, hit_at DESC);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api_rate_limits"
  ON public.api_rate_limits FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert api_rate_limits"
  ON public.api_rate_limits FOR INSERT
  TO service_role
  WITH CHECK (true);