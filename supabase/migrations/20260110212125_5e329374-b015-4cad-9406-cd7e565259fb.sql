-- Add columns to funding_metrics to track contribution completeness
ALTER TABLE public.funding_metrics
ADD COLUMN IF NOT EXISTS contributions_fetched integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS contributions_total integer DEFAULT NULL;

COMMENT ON COLUMN public.funding_metrics.contributions_fetched IS 'Number of itemized contributions fetched from FEC';
COMMENT ON COLUMN public.funding_metrics.contributions_total IS 'Total number of itemized contributions available from FEC (from pagination.count)';