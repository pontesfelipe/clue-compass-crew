-- Data Pipeline Performance and Reliability Improvements
-- Phase 1: Quick Wins - Database Indexes and Optimizations
-- Created: 2026-04-28

-- ============================================================================
-- PART 1: PERFORMANCE INDEXES
-- ============================================================================

-- Optimize sync job queries (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_progress_status_priority 
  ON sync_progress(status, priority DESC) 
  WHERE status = 'queued';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_job_runs_started 
  ON sync_job_runs(started_at DESC, job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_job_runs_job_status 
  ON sync_job_runs(job_id, status, started_at DESC);

-- Optimize member data queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_fec_candidate 
  ON members(fec_candidate_id) 
  WHERE fec_candidate_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_contributions_member_cycle 
  ON member_contributions(member_id, cycle);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_committees_member 
  ON member_committees(member_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_politician_issue_positions_politician 
  ON politician_issue_positions(politician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_scores_member_user 
  ON member_scores(member_id, user_id);

-- Optimize anomaly and monitoring queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_anomalies_unresolved 
  ON data_anomalies(detected_at DESC) 
  WHERE resolved_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_anomalies_entity 
  ON data_anomalies(entity_type, entity_id, detected_at DESC);

-- Optimize bill and vote queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_issue_signals_bill_type 
  ON issue_signals(bill_id, signal_type) 
  WHERE signal_type = 'bill_sponsorship';

-- ============================================================================
-- PART 2: JOB LOCKING SYSTEM
-- ============================================================================

-- Create job locks table for preventing race conditions
CREATE TABLE IF NOT EXISTS job_locks (
  job_id TEXT PRIMARY KEY,
  lock_token UUID NOT NULL DEFAULT gen_random_uuid(),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON job_locks(expires_at);

-- Function to acquire lock with automatic expiry
CREATE OR REPLACE FUNCTION acquire_job_lock(
  p_job_id TEXT,
  p_locked_by TEXT,
  p_duration_seconds INTEGER DEFAULT 300
) RETURNS UUID AS $$
DECLARE
  v_token UUID;
BEGIN
  -- Clean expired locks first
  DELETE FROM job_locks WHERE expires_at < NOW();
  
  -- Try to insert lock
  INSERT INTO job_locks (job_id, locked_by, expires_at)
  VALUES (p_job_id, p_locked_by, NOW() + (p_duration_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING lock_token INTO v_token;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- Function to release lock
CREATE OR REPLACE FUNCTION release_job_lock(
  p_job_id TEXT,
  p_lock_token UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM job_locks 
  WHERE job_id = p_job_id AND lock_token = p_lock_token;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to extend lock
CREATE OR REPLACE FUNCTION extend_job_lock(
  p_job_id TEXT,
  p_lock_token UUID,
  p_additional_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE job_locks 
  SET expires_at = NOW() + (p_additional_seconds || ' seconds')::INTERVAL
  WHERE job_id = p_job_id AND lock_token = p_lock_token;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: CIRCUIT BREAKER STATE PERSISTENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 4: RATE LIMIT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  endpoint TEXT,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_after_seconds INTEGER,
  response_status INTEGER,
  response_headers JSONB,
  request_context JSONB
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_provider_time 
  ON api_rate_limits(provider, hit_at DESC);

-- ============================================================================
-- PART 5: IDEMPOTENCY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_operations (
  idempotency_key TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_job_status 
  ON sync_operations(job_id, status, started_at DESC);

-- ============================================================================
-- PART 6: DATA COVERAGE MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS data_coverage_stats AS
SELECT
  COUNT(DISTINCT m.id) as total_members,
  COUNT(DISTINCT CASE WHEN mc.member_id IS NOT NULL THEN m.id END) as members_with_contributions,
  COUNT(DISTINCT CASE WHEN mcom.member_id IS NOT NULL THEN m.id END) as members_with_committees,
  COUNT(DISTINCT CASE WHEN pip.politician_id IS NOT NULL THEN m.id END) as members_with_positions,
  COUNT(DISTINCT CASE WHEN ms.member_id IS NOT NULL AND ms.user_id IS NULL THEN m.id END) as members_with_scores,
  (SELECT COUNT(*) FROM bills) as total_bills,
  (SELECT COUNT(DISTINCT bill_id) FROM issue_signals WHERE signal_type = 'bill_sponsorship') as bills_classified,
  NOW() as last_updated
FROM members m
LEFT JOIN member_contributions mc ON m.id = mc.member_id
LEFT JOIN member_committees mcom ON m.id = mcom.member_id
LEFT JOIN politician_issue_positions pip ON m.id = pip.politician_id
LEFT JOIN member_scores ms ON m.id = ms.member_id;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_coverage_stats_unique ON data_coverage_stats(last_updated);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_data_coverage_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY data_coverage_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Add constraints for data integrity
ALTER TABLE member_contributions 
  DROP CONSTRAINT IF EXISTS chk_contribution_amount_positive;
ALTER TABLE member_contributions 
  ADD CONSTRAINT chk_contribution_amount_positive 
  CHECK (amount >= 0);

ALTER TABLE sync_job_runs 
  DROP CONSTRAINT IF EXISTS chk_records_non_negative;
ALTER TABLE sync_job_runs 
  ADD CONSTRAINT chk_records_non_negative 
  CHECK (
    (records_fetched IS NULL OR records_fetched >= 0) AND 
    (records_upserted IS NULL OR records_upserted >= 0)
  );

-- ============================================================================
-- PART 8: CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up old rate limit records (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM api_rate_limits 
  WHERE hit_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old sync operations (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_sync_operations()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM sync_operations 
  WHERE completed_at < NOW() - INTERVAL '30 days'
  AND status IN ('complete', 'failed');
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE job_locks IS 'Distributed locking system to prevent concurrent job execution and race conditions';
COMMENT ON TABLE circuit_breaker_state IS 'Persistent circuit breaker state for API failure protection';
COMMENT ON TABLE api_rate_limits IS 'Tracking of API rate limit hits for observability and optimization';
COMMENT ON TABLE sync_operations IS 'Idempotency tracking for safe retry of sync operations';
COMMENT ON MATERIALIZED VIEW data_coverage_stats IS 'Pre-computed data coverage statistics for fast dashboard loading';

COMMENT ON FUNCTION acquire_job_lock IS 'Acquires a distributed lock for a job with automatic expiry';
COMMENT ON FUNCTION release_job_lock IS 'Releases a job lock using the lock token';
COMMENT ON FUNCTION extend_job_lock IS 'Extends the expiry time of an existing job lock';
COMMENT ON FUNCTION refresh_data_coverage_stats IS 'Refreshes the materialized view of data coverage statistics';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes rate limit records older than 7 days';
COMMENT ON FUNCTION cleanup_old_sync_operations IS 'Removes completed sync operations older than 30 days';

-- Made with Bob
