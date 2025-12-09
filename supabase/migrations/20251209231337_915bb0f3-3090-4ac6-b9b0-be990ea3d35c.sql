-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all user_scoring_preferences
CREATE POLICY "Admins can view all preferences" ON public.user_scoring_preferences
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));