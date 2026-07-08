-- Revoke EXECUTE from anon and authenticated on SECURITY DEFINER functions
-- that are only invoked by triggers or internal/service-role callers.
REVOKE EXECUTE ON FUNCTION public.log_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_user_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_user_activity_logs() FROM PUBLIC, anon, authenticated;

-- has_role is intentionally callable by signed-in users because RLS policies
-- invoke it; keep authenticated EXECUTE but revoke from anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;