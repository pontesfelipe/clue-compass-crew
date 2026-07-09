
-- Job locks table for cross-invocation coordination of sync jobs
CREATE TABLE IF NOT EXISTS public.job_locks (
  job_id TEXT PRIMARY KEY,
  lock_token UUID NOT NULL DEFAULT gen_random_uuid(),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON public.job_locks(expires_at);

GRANT ALL ON public.job_locks TO service_role;

ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view job_locks" ON public.job_locks;
CREATE POLICY "Admins can view job_locks"
  ON public.job_locks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Acquire an atomic job lock with automatic expiry
CREATE OR REPLACE FUNCTION public.acquire_job_lock(
  p_job_id TEXT,
  p_locked_by TEXT,
  p_duration_seconds INTEGER DEFAULT 300
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  DELETE FROM public.job_locks WHERE expires_at < NOW();

  INSERT INTO public.job_locks (job_id, locked_by, expires_at)
  VALUES (p_job_id, p_locked_by, NOW() + (p_duration_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING lock_token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_job_lock(
  p_job_id TEXT,
  p_lock_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.job_locks
  WHERE job_id = p_job_id AND lock_token = p_lock_token;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_job_lock(
  p_job_id TEXT,
  p_lock_token UUID,
  p_additional_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.job_locks
  SET expires_at = NOW() + (p_additional_seconds || ' seconds')::INTERVAL
  WHERE job_id = p_job_id AND lock_token = p_lock_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_job_lock(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_job_lock(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extend_job_lock(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_job_lock(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_job_lock(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_job_lock(TEXT, UUID, INTEGER) TO service_role;

-- Remove the obsolete duplicate sync_jobs entry that was causing "Unknown job type: issue-signals" failures.
-- classify-issues (job_type=classification) already covers the same work via classify-issue-signals.
DELETE FROM public.sync_jobs WHERE id = 'issue-signals';
