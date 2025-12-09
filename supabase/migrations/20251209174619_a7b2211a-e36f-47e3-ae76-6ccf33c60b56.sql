-- Add contact information columns to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS office_address TEXT,
ADD COLUMN IF NOT EXISTS office_city TEXT,
ADD COLUMN IF NOT EXISTS office_state TEXT,
ADD COLUMN IF NOT EXISTS office_zip TEXT;