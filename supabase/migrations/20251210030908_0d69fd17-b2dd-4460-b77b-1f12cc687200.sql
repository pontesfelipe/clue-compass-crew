-- Add cursor column to sync_progress for better incremental sync tracking
ALTER TABLE public.sync_progress 
ADD COLUMN IF NOT EXISTS cursor text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS metadata jsonb;