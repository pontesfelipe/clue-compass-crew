-- Implement data retention and IP anonymization for user_activity_log
-- This addresses privacy concerns about storing sensitive browsing patterns

-- Create a function to anonymize IP addresses after 7 days and delete old logs after 90 days
CREATE OR REPLACE FUNCTION public.cleanup_user_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anonymize IP addresses for records older than 7 days
  -- Replace with anonymized value to preserve log integrity while protecting privacy
  UPDATE public.user_activity_log
  SET 
    ip_address = 'anonymized',
    user_agent = CASE 
      WHEN user_agent IS NOT NULL THEN 'anonymized'
      ELSE NULL
    END
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND ip_address IS NOT NULL 
    AND ip_address != 'anonymized';

  -- Delete activity logs older than 90 days to limit data retention
  DELETE FROM public.user_activity_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Add comment explaining the data retention policy
COMMENT ON FUNCTION public.cleanup_user_activity_logs() IS 'Anonymizes IP addresses and user agents after 7 days, deletes logs older than 90 days. Should be called periodically via scheduled job.';

-- Run the cleanup immediately to anonymize any existing old data
SELECT public.cleanup_user_activity_logs();