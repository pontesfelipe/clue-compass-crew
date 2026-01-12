-- PHASE 1: Critical Data Pipeline Fixes

-- ==========================================
-- 1. Add columns to member_scores table for tracking score quality
-- ==========================================
ALTER TABLE member_scores
ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS provisional_reason TEXT,
ADD COLUMN IF NOT EXISTS data_points_used INTEGER DEFAULT 0;

-- Create index for querying provisional scores
CREATE INDEX IF NOT EXISTS idx_member_scores_provisional
ON member_scores(is_provisional) WHERE is_provisional = true;

-- Add comments explaining the columns
COMMENT ON COLUMN member_scores.is_provisional IS
'True if score is a baseline/estimate pending real data collection';

COMMENT ON COLUMN member_scores.data_points_used IS
'Number of votes, bills, and other data points used to calculate this score';

-- ==========================================
-- 2. Create data completeness tracking table
-- ==========================================
CREATE TABLE IF NOT EXISTS member_data_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Core data completeness flags
  basic_info_complete BOOLEAN DEFAULT false,
  contact_info_complete BOOLEAN DEFAULT false,
  finance_data_complete BOOLEAN DEFAULT false,
  committee_data_complete BOOLEAN DEFAULT false,
  vote_data_complete BOOLEAN DEFAULT false,
  bills_data_complete BOOLEAN DEFAULT false,
  score_data_valid BOOLEAN DEFAULT false,

  -- Overall completeness percentage (0-100)
  completeness_percentage DECIMAL(5,2) DEFAULT 0.0,

  -- Missing fields detail
  missing_fields TEXT[] DEFAULT '{}',

  -- Timestamps
  last_validated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(member_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_member_data_completeness_member
ON member_data_completeness(member_id);

CREATE INDEX IF NOT EXISTS idx_member_data_completeness_percentage
ON member_data_completeness(completeness_percentage);

CREATE INDEX IF NOT EXISTS idx_member_data_completeness_validated
ON member_data_completeness(last_validated_at DESC);

-- Enable RLS
ALTER TABLE member_data_completeness ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read access)
CREATE POLICY "Public read access for member_data_completeness"
ON member_data_completeness FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER set_member_data_completeness_updated_at
  BEFORE UPDATE ON member_data_completeness
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE member_data_completeness IS
'Tracks data completeness for each member to identify gaps and quality issues';

COMMENT ON COLUMN member_data_completeness.completeness_percentage IS
'Weighted percentage of data completeness (0-100)';

COMMENT ON COLUMN member_data_completeness.missing_fields IS
'Array of field names that are missing or incomplete';

-- ==========================================
-- 3. Create data quality metrics table
-- ==========================================
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_description TEXT,

  -- Metric values
  current_value DECIMAL(10,2) NOT NULL,
  threshold_warning DECIMAL(10,2),
  threshold_critical DECIMAL(10,2),

  -- Status
  status TEXT CHECK (status IN ('healthy', 'warning', 'critical')) DEFAULT 'healthy',

  -- Metadata
  category TEXT, -- e.g., 'completeness', 'freshness', 'accuracy'
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_name
ON data_quality_metrics(metric_name);

CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_status
ON data_quality_metrics(status) WHERE status != 'healthy';

CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_checked
ON data_quality_metrics(checked_at DESC);

-- Enable RLS
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read access for transparency)
CREATE POLICY "Public read access for data_quality_metrics"
ON data_quality_metrics FOR SELECT
USING (true);

COMMENT ON TABLE data_quality_metrics IS
'Tracks data quality metrics and alerts for monitoring data pipeline health';

-- ==========================================
-- 4. Create FEC candidate mapping table
-- ==========================================
CREATE TABLE IF NOT EXISTS members_fec_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bioguide_id TEXT NOT NULL,

  -- FEC identifiers
  fec_candidate_id TEXT,
  fec_committee_id TEXT,

  -- Matching metadata
  match_method TEXT CHECK (match_method IN (
    'bioguide_direct',      -- FEC data had bioguide_id
    'name_state_exact',     -- Exact name + state match
    'name_state_fuzzy',     -- Fuzzy name + state match
    'manual',               -- Manually verified
    'unmatched'             -- No FEC match found
  )),
  match_confidence DECIMAL(3,2) CHECK (match_confidence >= 0 AND match_confidence <= 1),

  -- Validation
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,

  -- Election cycles this mapping is valid for
  valid_cycles INTEGER[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(member_id),
  UNIQUE(bioguide_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fec_mapping_member ON members_fec_mapping(member_id);
CREATE INDEX IF NOT EXISTS idx_fec_mapping_bioguide ON members_fec_mapping(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_fec_mapping_fec_candidate ON members_fec_mapping(fec_candidate_id);
CREATE INDEX IF NOT EXISTS idx_fec_mapping_unmatched ON members_fec_mapping(match_method) WHERE match_method = 'unmatched';
CREATE INDEX IF NOT EXISTS idx_fec_mapping_unverified ON members_fec_mapping(is_verified) WHERE is_verified = false;

-- Enable RLS
ALTER TABLE members_fec_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Public read access for members_fec_mapping" ON members_fec_mapping FOR SELECT USING (true);

-- Add updated_at trigger
CREATE TRIGGER set_members_fec_mapping_updated_at
  BEFORE UPDATE ON members_fec_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE members_fec_mapping IS
'Explicit mapping between Congressional members and FEC candidate/committee IDs';

-- ==========================================
-- 5. Add dependencies column to sync_jobs table
-- ==========================================
ALTER TABLE sync_jobs
ADD COLUMN IF NOT EXISTS dependencies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS wait_for_dependencies BOOLEAN DEFAULT true;

COMMENT ON COLUMN sync_jobs.dependencies IS
'Array of job names that must complete successfully before this job can run';

COMMENT ON COLUMN sync_jobs.wait_for_dependencies IS
'If true, job will not run until all dependencies have completed successfully';

-- ==========================================
-- 6. Create view to visualize sync job dependencies
-- ==========================================
CREATE OR REPLACE VIEW sync_job_dependencies AS
SELECT
  j.id as job_id,
  j.job_type,
  j.dependencies,
  j.priority,
  j.frequency_minutes,
  j.is_enabled,
  p.last_run_at,
  p.status as last_status,
  p.error_message
FROM sync_jobs j
LEFT JOIN sync_progress p ON j.id = p.id
ORDER BY j.priority DESC, j.job_type;