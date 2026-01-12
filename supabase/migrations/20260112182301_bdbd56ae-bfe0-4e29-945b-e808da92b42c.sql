-- Fix Security Definer View issue for sync_job_dependencies
-- Drop and recreate the view with security_invoker=on

DROP VIEW IF EXISTS public.sync_job_dependencies;

CREATE VIEW public.sync_job_dependencies
WITH (security_invoker = on)
AS
SELECT 
    j.id AS job_id,
    j.job_type,
    j.dependencies,
    j.priority,
    j.frequency_minutes,
    j.is_enabled,
    p.last_run_at,
    p.status AS last_status,
    p.error_message
FROM sync_jobs j
LEFT JOIN sync_progress p ON j.id = p.id
ORDER BY j.priority DESC, j.job_type;

-- Add comment explaining the security setting
COMMENT ON VIEW public.sync_job_dependencies IS 'View showing sync jobs with their dependencies and last run status. Uses SECURITY INVOKER to enforce RLS policies of the querying user.';