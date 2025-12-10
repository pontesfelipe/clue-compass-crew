-- Create user activity log table
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.user_activity_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
ON public.user_activity_log
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert activity"
ON public.user_activity_log
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX idx_user_activity_log_created_at ON public.user_activity_log(created_at DESC);

-- Create trigger function to log profile changes
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  -- Track what changed
  IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
    changes := changes || jsonb_build_object('first_name', jsonb_build_object('old', OLD.first_name, 'new', NEW.first_name));
  END IF;
  IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
    changes := changes || jsonb_build_object('last_name', jsonb_build_object('old', OLD.last_name, 'new', NEW.last_name));
  END IF;
  IF OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    changes := changes || jsonb_build_object('display_name', jsonb_build_object('old', OLD.display_name, 'new', NEW.display_name));
  END IF;
  IF OLD.home_state IS DISTINCT FROM NEW.home_state THEN
    changes := changes || jsonb_build_object('home_state', jsonb_build_object('old', OLD.home_state, 'new', NEW.home_state));
  END IF;
  IF OLD.zip_code IS DISTINCT FROM NEW.zip_code THEN
    changes := changes || jsonb_build_object('zip_code', jsonb_build_object('old', OLD.zip_code, 'new', NEW.zip_code));
  END IF;
  
  -- Only log if something changed
  IF changes != '{}'::jsonb THEN
    INSERT INTO public.user_activity_log (user_id, activity_type, description, metadata)
    VALUES (NEW.user_id, 'profile_update', 'Profile information updated', changes);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for profile updates
CREATE TRIGGER on_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_changes();

-- Create trigger function to log new user signups
CREATE OR REPLACE FUNCTION public.log_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_activity_log (user_id, activity_type, description, metadata)
  VALUES (NEW.user_id, 'signup', 'User account created', jsonb_build_object('email', NEW.email));
  RETURN NEW;
END;
$$;

-- Create trigger for new signups
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_signup();