-- Phase 1: Schema changes for state legislators

-- 1. Create level enum (federal vs state)
DO $$ BEGIN
  CREATE TYPE public.gov_level AS ENUM ('federal', 'state');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add level column to members table (default federal, backfill existing rows)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS level public.gov_level NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS openstates_id text,
  ADD COLUMN IF NOT EXISTS state_district_chamber text;

-- Backfill existing rows explicitly to federal (no-op due to default but explicit)
UPDATE public.members SET level = 'federal' WHERE level IS NULL;

-- Add index for state legislator lookups
CREATE INDEX IF NOT EXISTS idx_members_level_state ON public.members(level, state);
CREATE INDEX IF NOT EXISTS idx_members_openstates_id ON public.members(openstates_id) WHERE openstates_id IS NOT NULL;

-- bioguide_id is currently NOT NULL — state legislators won't have one.
-- Make it nullable so OpenStates members can be inserted with only openstates_id.
ALTER TABLE public.members ALTER COLUMN bioguide_id DROP NOT NULL;

-- Ensure exactly one of (bioguide_id, openstates_id) is present
ALTER TABLE public.members
  ADD CONSTRAINT members_external_id_present
  CHECK (bioguide_id IS NOT NULL OR openstates_id IS NOT NULL);

-- Unique on openstates_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_openstates_unique
  ON public.members(openstates_id) WHERE openstates_id IS NOT NULL;

-- 3. Add level + openstates id to bills (state bills have no congress)
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS level public.gov_level NOT NULL DEFAULT 'federal',
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS session text,
  ADD COLUMN IF NOT EXISTS openstates_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_openstates_unique
  ON public.bills(openstates_id) WHERE openstates_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_level_state ON public.bills(level, state);

-- congress is NOT NULL — state bills don't have one. Make nullable.
ALTER TABLE public.bills ALTER COLUMN congress DROP NOT NULL;

-- 4. Sync progress / job rows for state legislators
INSERT INTO public.sync_jobs (id, job_type, provider, frequency_minutes, priority, is_enabled, scope)
VALUES
  ('sync-state-legislators', 'state_legislators', 'openstates', 1440, 40, true, '{}'::jsonb),
  ('sync-state-bills', 'state_bills', 'openstates', 720, 45, true, '{}'::jsonb),
  ('sync-state-votes', 'state_votes', 'openstates', 720, 46, true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Register openstates as an api_source
INSERT INTO public.api_sources (name, base_url, description)
VALUES ('openstates', 'https://v3.openstates.org', 'OpenStates API for state legislators, bills, votes')
ON CONFLICT DO NOTHING;