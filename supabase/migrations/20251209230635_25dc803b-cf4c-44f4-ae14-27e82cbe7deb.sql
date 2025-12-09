-- Create api_sources table for tracking data sources
CREATE TABLE public.api_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_sources ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read api_sources" ON public.api_sources
  FOR SELECT USING (true);

-- Insert initial sources
INSERT INTO public.api_sources (name, base_url, description) VALUES
  ('congress_gov', 'https://api.congress.gov/v3', 'Official Congress.gov API for members, bills, and votes'),
  ('house_clerk', 'https://clerk.house.gov', 'House Clerk XML data for roll call votes'),
  ('fec', 'https://api.open.fec.gov/v1', 'Federal Election Commission campaign finance data');

-- Create api_sync_runs table for tracking sync history
CREATE TABLE public.api_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.api_sources(id),
  job_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  items_processed INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_sync_runs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read api_sync_runs" ON public.api_sync_runs
  FOR SELECT USING (true);

-- Create state_scores table for pre-computed state aggregates
CREATE TABLE public.state_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  avg_member_score NUMERIC,
  member_count INT DEFAULT 0,
  avg_productivity NUMERIC,
  avg_attendance NUMERIC,
  avg_bipartisanship NUMERIC,
  avg_issue_alignment NUMERIC,
  house_count INT DEFAULT 0,
  senate_count INT DEFAULT 0,
  democrat_count INT DEFAULT 0,
  republican_count INT DEFAULT 0,
  independent_count INT DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.state_scores ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read state_scores" ON public.state_scores
  FOR SELECT USING (true);

-- Add position_normalized and weight columns to member_votes
ALTER TABLE public.member_votes
ADD COLUMN IF NOT EXISTS position_normalized TEXT,
ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;

-- Add extensibility columns to member_scores
ALTER TABLE public.member_scores
ADD COLUMN IF NOT EXISTS transparency_score NUMERIC,
ADD COLUMN IF NOT EXISTS governance_score NUMERIC,
ADD COLUMN IF NOT EXISTS finance_influence_score NUMERIC,
ADD COLUMN IF NOT EXISTS lobbying_alignment_score NUMERIC;

-- Add raw JSONB columns to bills and votes for debugging
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS raw JSONB;

ALTER TABLE public.votes
ADD COLUMN IF NOT EXISTS raw JSONB;

-- Create index for faster state_scores lookups
CREATE INDEX IF NOT EXISTS idx_state_scores_state ON public.state_scores(state);

-- Create index for api_sync_runs queries
CREATE INDEX IF NOT EXISTS idx_api_sync_runs_job_type ON public.api_sync_runs(job_type);
CREATE INDEX IF NOT EXISTS idx_api_sync_runs_status ON public.api_sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_api_sync_runs_started_at ON public.api_sync_runs(started_at DESC);

-- Create trigger for state_scores updated_at
CREATE TRIGGER update_state_scores_updated_at
  BEFORE UPDATE ON public.state_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();