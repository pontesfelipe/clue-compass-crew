-- Deduplicate any existing rows first so the unique constraint can be added
DELETE FROM public.member_lobbying a
USING public.member_lobbying b
WHERE a.ctid < b.ctid
  AND a.member_id = b.member_id
  AND a.industry = b.industry
  AND a.cycle = b.cycle;

ALTER TABLE public.member_lobbying
  ADD CONSTRAINT member_lobbying_member_industry_cycle_key
  UNIQUE (member_id, industry, cycle);

CREATE INDEX IF NOT EXISTS idx_member_lobbying_cycle ON public.member_lobbying(cycle);