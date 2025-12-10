-- Create feature toggles table for admin-controlled features
CREATE TABLE public.feature_toggles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

-- Only admins can view feature toggles
CREATE POLICY "Admins can view feature toggles"
ON public.feature_toggles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update feature toggles
CREATE POLICY "Admins can update feature toggles"
ON public.feature_toggles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Public can read feature toggles (needed for frontend to check if features are enabled)
CREATE POLICY "Anyone can read feature toggles"
ON public.feature_toggles
FOR SELECT
USING (true);

-- Insert default feature toggles
INSERT INTO public.feature_toggles (id, label, description, enabled) VALUES
  ('ai_summary', 'AI Member Summaries', 'Enable AI-generated summaries on member detail pages', true),
  ('alignment_widget', 'Your Alignment Widget', 'Show alignment score widget on member pages for logged-in users', true),
  ('my_matches', 'My Matches Page', 'Enable the personalized politician matches feature', true),
  ('member_tracking', 'Member Tracking', 'Allow users to track and receive notifications for members', true),
  ('funding_layer', 'Funding Influence Map Layer', 'Show funding influence visualization on the US map', true),
  ('profile_wizard', 'Profile Wizard', 'Enable the profile completion wizard for new users', true);

-- Trigger for updated_at
CREATE TRIGGER update_feature_toggles_updated_at
BEFORE UPDATE ON public.feature_toggles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();