-- Aggregate helpers to avoid PostgREST 1000-row silent truncation on
-- unbounded members+member_scores joins in the client.

CREATE OR REPLACE FUNCTION public.get_party_score_aggregates()
RETURNS TABLE(party text, avg_score numeric, member_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.party::text, AVG(ms.overall_score)::numeric, COUNT(*)::bigint
  FROM public.members m
  JOIN public.member_scores ms ON ms.member_id = m.id
  WHERE m.in_office = true
    AND ms.user_id IS NULL
    AND ms.overall_score IS NOT NULL
    AND m.party IN ('D','R','I')
  GROUP BY m.party;
$$;

CREATE OR REPLACE FUNCTION public.get_chamber_score_aggregates()
RETURNS TABLE(chamber text, avg_score numeric, member_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.chamber::text, AVG(ms.overall_score)::numeric, COUNT(*)::bigint
  FROM public.members m
  JOIN public.member_scores ms ON ms.member_id = m.id
  WHERE m.in_office = true
    AND ms.user_id IS NULL
    AND ms.overall_score IS NOT NULL
    AND m.chamber IN ('house','senate')
  GROUP BY m.chamber;
$$;

CREATE OR REPLACE FUNCTION public.get_state_score_aggregates()
RETURNS TABLE(state text, avg_score numeric, member_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.state::text, AVG(ms.overall_score)::numeric, COUNT(*)::bigint
  FROM public.members m
  JOIN public.member_scores ms ON ms.member_id = m.id
  WHERE m.in_office = true
    AND ms.user_id IS NULL
    AND ms.overall_score IS NOT NULL
    AND m.state IS NOT NULL
  GROUP BY m.state;
$$;

CREATE OR REPLACE FUNCTION public.get_state_stat_aggregates(p_state text)
RETURNS TABLE(
  member_count bigint,
  avg_score numeric,
  total_bills_sponsored bigint,
  avg_attendance numeric,
  avg_bipartisanship numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    AVG(ms.overall_score)::numeric,
    COALESCE(SUM(ms.bills_sponsored), 0)::bigint,
    AVG(ms.attendance_score)::numeric,
    AVG(ms.bipartisanship_score)::numeric
  FROM public.members m
  JOIN public.member_scores ms ON ms.member_id = m.id
  WHERE m.in_office = true
    AND ms.user_id IS NULL
    AND m.state = p_state;
$$;

CREATE OR REPLACE FUNCTION public.get_congress_sessions()
RETURNS TABLE(congress integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT b.congress FROM public.bills b ORDER BY b.congress DESC;
$$;

-- Grant execute to both anon and authenticated (data returned is public).
GRANT EXECUTE ON FUNCTION public.get_party_score_aggregates() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chamber_score_aggregates() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_state_score_aggregates() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_state_stat_aggregates(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_congress_sessions() TO anon, authenticated;