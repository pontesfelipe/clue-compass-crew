-- Add FEC identifiers to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT,
ADD COLUMN IF NOT EXISTS fec_committee_ids TEXT[],
ADD COLUMN IF NOT EXISTS fec_last_synced_at TIMESTAMP WITH TIME ZONE;

-- Create funding_metrics table for computed FEC metrics
CREATE TABLE public.funding_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL,
  
  -- Raw amounts
  total_receipts NUMERIC DEFAULT 0,
  
  -- Percentages (0-100)
  pct_from_individuals NUMERIC,
  pct_from_committees NUMERIC,
  pct_from_small_donors NUMERIC,
  pct_from_in_state NUMERIC,
  pct_from_out_of_state NUMERIC,
  
  -- Derived scores (0-100)
  grassroots_support_score NUMERIC,
  pac_dependence_score NUMERIC,
  local_money_score NUMERIC,
  
  -- Metadata
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint
  CONSTRAINT unique_member_cycle UNIQUE (member_id, cycle)
);

-- Enable RLS
ALTER TABLE public.funding_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access for funding metrics
CREATE POLICY "Funding metrics are viewable by everyone"
ON public.funding_metrics FOR SELECT
USING (true);

-- Create index for performance
CREATE INDEX idx_funding_metrics_member_id ON public.funding_metrics(member_id);
CREATE INDEX idx_funding_metrics_cycle ON public.funding_metrics(cycle);

-- Add trigger for updated_at
CREATE TRIGGER update_funding_metrics_updated_at
BEFORE UPDATE ON public.funding_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add funding score columns to state_scores table
ALTER TABLE public.state_scores
ADD COLUMN IF NOT EXISTS avg_grassroots_support NUMERIC,
ADD COLUMN IF NOT EXISTS avg_pac_dependence NUMERIC,
ADD COLUMN IF NOT EXISTS avg_local_money NUMERIC,
ADD COLUMN IF NOT EXISTS avg_pct_out_of_state NUMERIC;