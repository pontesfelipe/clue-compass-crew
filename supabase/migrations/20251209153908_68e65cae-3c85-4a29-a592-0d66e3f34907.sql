-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to track sync progress
CREATE TABLE IF NOT EXISTS public.sync_progress (
  id TEXT PRIMARY KEY,
  current_offset INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_matched_count INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_progress ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public can read sync_progress" ON public.sync_progress FOR SELECT USING (true);

-- Insert initial record for FEC sync
INSERT INTO public.sync_progress (id, current_offset, status)
VALUES ('fec-finance', 0, 'idle')
ON CONFLICT (id) DO NOTHING;