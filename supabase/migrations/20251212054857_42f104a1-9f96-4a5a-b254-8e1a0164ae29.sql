-- ================================================================================
-- DATA PIPELINE IMPROVEMENTS: Sync State, Job Locks, and Data Quality
-- Based on: clue-compass-data-quality-and-finance-improvements.txt
-- ================================================================================

-- 1) Add job locking columns to sync_progress if not exists
ALTER TABLE sync_progress 
  ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_success_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cursor_json JSONB DEFAULT '{}';

-- 2) Create data_anomalies table for quality tracking
CREATE TABLE IF NOT EXISTS public.data_anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anomaly_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  details_json JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on data_anomalies
ALTER TABLE public.data_anomalies ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all anomalies
CREATE POLICY "Admins can view data anomalies" 
ON public.data_anomalies 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Add contribution tracking fields to member_contributions for better FEC data
ALTER TABLE member_contributions
  ADD COLUMN IF NOT EXISTS receipt_date DATE,
  ADD COLUMN IF NOT EXISTS contributor_city TEXT,
  ADD COLUMN IF NOT EXISTS contributor_zip TEXT,
  ADD COLUMN IF NOT EXISTS contributor_employer TEXT,
  ADD COLUMN IF NOT EXISTS contributor_occupation TEXT,
  ADD COLUMN IF NOT EXISTS committee_id TEXT,
  ADD COLUMN IF NOT EXISTS committee_name TEXT,
  ADD COLUMN IF NOT EXISTS memo_text TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS contribution_uid TEXT;

-- Create index on contribution_uid for faster upserts
CREATE INDEX IF NOT EXISTS idx_member_contributions_uid ON member_contributions(contribution_uid);

-- Create index on receipt_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_member_contributions_receipt_date ON member_contributions(receipt_date);

-- 4) Create a sync_jobs table for orchestration
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id TEXT NOT NULL PRIMARY KEY,
  job_type TEXT NOT NULL,
  priority INTEGER DEFAULT 50,
  frequency_minutes INTEGER DEFAULT 60,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  is_enabled BOOLEAN DEFAULT true,
  max_duration_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read sync_jobs
CREATE POLICY "Public can read sync_jobs" 
ON public.sync_jobs 
FOR SELECT 
USING (true);

-- Insert default job configurations
INSERT INTO public.sync_jobs (id, job_type, priority, frequency_minutes, is_enabled) VALUES
  ('congress-members', 'sync', 100, 1440, true),
  ('member-details', 'sync', 90, 1440, true),
  ('bills', 'sync', 80, 360, true),
  ('votes', 'sync', 70, 120, true),
  ('fec-finance', 'sync', 60, 300, true),
  ('fec-funding', 'sync', 55, 300, true),
  ('issue-signals', 'ai', 50, 360, true),
  ('politician-positions', 'compute', 45, 360, true),
  ('member-scores', 'compute', 40, 120, true),
  ('state-scores', 'compute', 30, 120, true)
ON CONFLICT (id) DO UPDATE SET
  frequency_minutes = EXCLUDED.frequency_minutes,
  priority = EXCLUDED.priority,
  updated_at = now();

-- 5) Add index for faster state aggregation queries
CREATE INDEX IF NOT EXISTS idx_funding_metrics_member_cycle 
ON funding_metrics(member_id, cycle DESC);

CREATE INDEX IF NOT EXISTS idx_member_scores_member_id 
ON member_scores(member_id);

-- 6) Create view for data freshness monitoring
CREATE OR REPLACE VIEW public.sync_health AS
SELECT 
  sp.id as job_id,
  sp.status,
  sp.last_run_at,
  sp.total_processed,
  sp.lock_until,
  sp.last_success_count,
  sp.last_failure_count,
  sj.frequency_minutes,
  sj.is_enabled,
  CASE 
    WHEN sp.lock_until IS NOT NULL AND sp.lock_until > now() THEN 'locked'
    WHEN sp.status = 'running' THEN 'running'
    WHEN sp.status = 'error' THEN 'error'
    WHEN sp.last_run_at IS NULL THEN 'never_run'
    WHEN sp.last_run_at < now() - (sj.frequency_minutes || ' minutes')::interval THEN 'stale'
    ELSE 'healthy'
  END as health_status,
  EXTRACT(EPOCH FROM (now() - sp.last_run_at)) / 60 as minutes_since_last_run
FROM sync_progress sp
LEFT JOIN sync_jobs sj ON sp.id = sj.id
ORDER BY sj.priority DESC NULLS LAST;