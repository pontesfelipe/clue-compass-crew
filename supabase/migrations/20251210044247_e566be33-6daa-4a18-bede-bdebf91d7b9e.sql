-- Add unique constraint for issue signals upsert
ALTER TABLE public.issue_signals 
ADD CONSTRAINT issue_signals_unique_ref 
UNIQUE (issue_id, signal_type, external_ref);