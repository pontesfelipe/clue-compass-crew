-- Phase 1.1 (retry with upfront lock)
BEGIN;

-- Take exclusive lock first so no concurrent inserts race with the dedupe
LOCK TABLE public.member_scores IN ACCESS EXCLUSIVE MODE;

-- Deduplicate keeping only newest row per (member_id, user_id)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY member_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY calculated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.member_scores
)
DELETE FROM public.member_scores ms
USING ranked r
WHERE ms.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS member_scores_member_user_uniq
  ON public.member_scores (member_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.member_scores
  ADD COLUMN IF NOT EXISTS alignment_score numeric(5,2);

COMMENT ON COLUMN public.member_scores.alignment_score IS
  'Real per-user issue alignment (0-100), populated only after compute-politician-positions runs against user priorities. NULL means not yet computed.';
COMMENT ON COLUMN public.member_scores.issue_alignment_score IS
  'Legacy: legislative activity diversity proxy (50-85 range). Not real alignment.';

CREATE INDEX IF NOT EXISTS member_contributions_member_cycle_idx
  ON public.member_contributions (member_id, cycle);

CREATE INDEX IF NOT EXISTS member_lobbying_member_cycle_idx
  ON public.member_lobbying (member_id, cycle);

COMMIT;
