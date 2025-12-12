-- Create sync_state table for watermarks/cursors per dataset
CREATE TABLE IF NOT EXISTS public.sync_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  dataset text NOT NULL,
  scope_key text NOT NULL DEFAULT 'global',
  last_success_at timestamptz,
  last_cursor jsonb DEFAULT '{}'::jsonb,
  last_modified text,
  records_total integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, dataset, scope_key)
);

-- Create sync_job_runs table for observability
CREATE TABLE IF NOT EXISTS public.sync_job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id text NOT NULL,
  provider text NOT NULL,
  job_type text NOT NULL,
  scope jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  records_fetched integer DEFAULT 0,
  records_upserted integer DEFAULT 0,
  api_calls integer DEFAULT 0,
  wait_time_ms integer DEFAULT 0,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for sync_job_runs
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_job_id ON public.sync_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_status ON public.sync_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_started_at ON public.sync_job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_provider ON public.sync_job_runs(provider);

-- Add new columns to sync_jobs for proper queue functionality
ALTER TABLE public.sync_jobs 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS scope jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cursor jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS provider text;

-- Update provider column based on job_type
UPDATE public.sync_jobs SET provider = 
  CASE 
    WHEN id LIKE 'fec%' THEN 'fec'
    WHEN id LIKE 'congress%' OR id IN ('sync-bills', 'sync-votes', 'sync-members') THEN 'congress'
    ELSE 'internal'
  END
WHERE provider IS NULL;

-- Add index for job queue processing
CREATE INDEX IF NOT EXISTS idx_sync_jobs_queue ON public.sync_jobs(status, next_run_at) 
WHERE is_enabled = true;

-- Enable RLS on new tables
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_job_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_state
CREATE POLICY "Admins can manage sync_state" ON public.sync_state
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read sync_state" ON public.sync_state
FOR SELECT USING (true);

-- RLS policies for sync_job_runs
CREATE POLICY "Admins can manage sync_job_runs" ON public.sync_job_runs
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read sync_job_runs" ON public.sync_job_runs
FOR SELECT USING (true);

-- Add sync_enabled setting to feature_toggles if not exists
INSERT INTO public.feature_toggles (id, label, description, enabled)
VALUES ('sync_enabled', 'Sync Enabled', 'Master toggle for all data synchronization', true)
ON CONFLICT (id) DO NOTHING;

-- Create trigger for sync_state updated_at
CREATE OR REPLACE FUNCTION public.update_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_sync_state_updated_at ON public.sync_state;
CREATE TRIGGER update_sync_state_updated_at
BEFORE UPDATE ON public.sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_sync_state_updated_at();