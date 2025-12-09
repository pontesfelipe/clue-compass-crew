-- Add contributor_state column to member_contributions
ALTER TABLE public.member_contributions 
ADD COLUMN contributor_state text;