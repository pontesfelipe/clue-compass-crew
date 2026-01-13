-- Create FEC sync state table for resumable pagination
CREATE TABLE IF NOT EXISTS public.fec_sync_state (
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL,
  last_page_fetched INTEGER DEFAULT 0,
  total_pages_estimated INTEGER,
  contributions_count INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, cycle)
);

-- Index for priority queue queries
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_incomplete
  ON public.fec_sync_state (is_complete, contributions_count, last_synced_at)
  WHERE is_complete = FALSE;

-- Index for monitoring
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_member_cycle
  ON public.fec_sync_state (member_id, cycle);

-- Index for cycle-specific queries
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_cycle
  ON public.fec_sync_state (cycle, is_complete);

COMMENT ON TABLE public.fec_sync_state IS 'Tracks FEC contribution sync progress per member per cycle for resumable pagination';
COMMENT ON COLUMN public.fec_sync_state.last_page_fetched IS 'Last FEC API page successfully fetched (0 = not started)';
COMMENT ON COLUMN public.fec_sync_state.total_pages_estimated IS 'Total pages reported by FEC API pagination';
COMMENT ON COLUMN public.fec_sync_state.contributions_count IS 'Number of contributions fetched so far';
COMMENT ON COLUMN public.fec_sync_state.is_complete IS 'TRUE when all pages for this member+cycle have been fetched';
COMMENT ON COLUMN public.fec_sync_state.retry_count IS 'Number of retry attempts after errors';

-- Enable RLS
ALTER TABLE public.fec_sync_state ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access on fec_sync_state" ON public.fec_sync_state
  FOR ALL USING (true) WITH CHECK (true);

-- Create Manual FEC Mapping Table for overrides when automatic matching fails
CREATE TABLE IF NOT EXISTS public.fec_manual_mapping (
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  fec_candidate_id TEXT NOT NULL,
  verified_by TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id)
);

CREATE INDEX IF NOT EXISTS idx_fec_manual_mapping_candidate
  ON public.fec_manual_mapping (fec_candidate_id);

COMMENT ON TABLE public.fec_manual_mapping IS 'Manual overrides for FEC candidate ID matching when automatic matching fails';
COMMENT ON COLUMN public.fec_manual_mapping.fec_candidate_id IS 'FEC candidate ID to use for this member';
COMMENT ON COLUMN public.fec_manual_mapping.verified_by IS 'Admin username who created this mapping';

-- Enable RLS
ALTER TABLE public.fec_manual_mapping ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on fec_manual_mapping" ON public.fec_manual_mapping
  FOR ALL USING (true) WITH CHECK (true);

-- Create view to monitor FEC sync completeness
CREATE OR REPLACE VIEW public.fec_sync_completeness AS
SELECT
  m.id AS member_id,
  m.full_name,
  m.state,
  m.party,
  m.chamber,
  m.in_office,
  m.fec_candidate_id,
  m.fec_last_synced_at,
  -- Per-cycle completeness
  COALESCE(s2026.is_complete, false) AS cycle_2026_complete,
  COALESCE(s2026.contributions_count, 0) AS cycle_2026_count,
  COALESCE(s2024.is_complete, false) AS cycle_2024_complete,
  COALESCE(s2024.contributions_count, 0) AS cycle_2024_count,
  COALESCE(s2022.is_complete, false) AS cycle_2022_complete,
  COALESCE(s2022.contributions_count, 0) AS cycle_2022_count,
  COALESCE(s2020.is_complete, false) AS cycle_2020_complete,
  COALESCE(s2020.contributions_count, 0) AS cycle_2020_count,
  COALESCE(s2018.is_complete, false) AS cycle_2018_complete,
  COALESCE(s2018.contributions_count, 0) AS cycle_2018_count,
  -- Total contributions across all cycles
  COALESCE(s2026.contributions_count, 0) +
  COALESCE(s2024.contributions_count, 0) +
  COALESCE(s2022.contributions_count, 0) +
  COALESCE(s2020.contributions_count, 0) +
  COALESCE(s2018.contributions_count, 0) AS total_contributions,
  -- Completeness score (% of cycles complete)
  (
    CASE WHEN COALESCE(s2026.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2024.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2022.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2020.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2018.is_complete, false) THEN 1 ELSE 0 END
  ) * 20 AS completeness_percent,
  -- Has FEC match?
  CASE
    WHEN m.fec_candidate_id IS NOT NULL THEN true
    WHEN EXISTS (SELECT 1 FROM public.fec_manual_mapping WHERE member_id = m.id) THEN true
    ELSE false
  END AS has_fec_match
FROM public.members m
LEFT JOIN public.fec_sync_state s2026 ON m.id = s2026.member_id AND s2026.cycle = 2026
LEFT JOIN public.fec_sync_state s2024 ON m.id = s2024.member_id AND s2024.cycle = 2024
LEFT JOIN public.fec_sync_state s2022 ON m.id = s2022.member_id AND s2022.cycle = 2022
LEFT JOIN public.fec_sync_state s2020 ON m.id = s2020.member_id AND s2020.cycle = 2020
LEFT JOIN public.fec_sync_state s2018 ON m.id = s2018.member_id AND s2018.cycle = 2018
WHERE m.in_office = true
ORDER BY completeness_percent ASC, total_contributions ASC;

COMMENT ON VIEW public.fec_sync_completeness IS 'Monitoring view for FEC sync data completeness per member';