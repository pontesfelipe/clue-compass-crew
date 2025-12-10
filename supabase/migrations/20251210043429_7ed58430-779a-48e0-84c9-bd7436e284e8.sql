-- Add unique constraint for upsert to work
ALTER TABLE public.politician_issue_positions 
ADD CONSTRAINT politician_issue_positions_politician_issue_unique 
UNIQUE (politician_id, issue_id);