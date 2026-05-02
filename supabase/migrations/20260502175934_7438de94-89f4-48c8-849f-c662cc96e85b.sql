-- Make votes table support state-level data
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS level public.gov_level NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS openstates_vote_id text;

ALTER TABLE public.votes ALTER COLUMN congress DROP NOT NULL;
ALTER TABLE public.votes ALTER COLUMN session DROP NOT NULL;
ALTER TABLE public.votes ALTER COLUMN roll_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_openstates_unique
  ON public.votes(openstates_vote_id) WHERE openstates_vote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votes_level ON public.votes(level);

-- Ensure either federal triple OR openstates id is present
ALTER TABLE public.votes
  ADD CONSTRAINT votes_external_id_present
  CHECK (
    openstates_vote_id IS NOT NULL
    OR (congress IS NOT NULL AND roll_number IS NOT NULL)
  );