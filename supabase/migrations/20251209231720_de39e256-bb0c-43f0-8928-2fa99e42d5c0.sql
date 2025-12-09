-- Add first_name and last_name columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Create terms_acceptances table to track T&C acceptance
CREATE TABLE public.terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can view their own acceptances
CREATE POLICY "Users can view own acceptances" ON public.terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own acceptances
CREATE POLICY "Users can insert own acceptances" ON public.terms_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all acceptances
CREATE POLICY "Admins can view all acceptances" ON public.terms_acceptances
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user_id ON public.terms_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_version ON public.terms_acceptances(terms_version);

-- Update the handle_new_user function to include first_name and last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, display_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      CONCAT(NEW.raw_user_meta_data ->> 'first_name', ' ', NEW.raw_user_meta_data ->> 'last_name'),
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    )
  );
  
  INSERT INTO public.user_scoring_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;