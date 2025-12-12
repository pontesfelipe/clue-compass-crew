-- Add unique constraint for funding_metrics upsert (member_id, cycle)
-- Check if constraint exists first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'funding_metrics_member_id_cycle_key'
  ) THEN
    ALTER TABLE public.funding_metrics 
    ADD CONSTRAINT funding_metrics_member_id_cycle_key 
    UNIQUE (member_id, cycle);
  END IF;
END $$;

-- Create index for efficient lookups if not exists
CREATE INDEX IF NOT EXISTS idx_funding_metrics_member_cycle 
ON public.funding_metrics (member_id, cycle);