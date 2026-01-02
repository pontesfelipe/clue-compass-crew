-- Fix profiles table: Add explicit authentication requirement to SELECT policies
-- Drop existing SELECT policies and recreate with explicit auth check

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate with explicit authentication check (auth.uid() IS NOT NULL)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));