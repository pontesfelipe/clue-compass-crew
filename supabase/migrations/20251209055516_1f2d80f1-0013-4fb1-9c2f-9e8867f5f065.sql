-- Create table for campaign contributions/donors
CREATE TABLE public.member_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  contributor_name TEXT NOT NULL,
  contributor_type TEXT NOT NULL CHECK (contributor_type IN ('individual', 'pac', 'organization')),
  amount NUMERIC NOT NULL DEFAULT 0,
  cycle INTEGER NOT NULL,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for lobbying data
CREATE TABLE public.member_lobbying (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  client_count INTEGER DEFAULT 0,
  cycle INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for corporate/org sponsors
CREATE TABLE public.member_sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  sponsor_type TEXT NOT NULL CHECK (sponsor_type IN ('corporation', 'nonprofit', 'trade_association', 'union')),
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('donor', 'endorsement', 'pac_support')),
  total_support NUMERIC DEFAULT 0,
  cycle INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.member_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_lobbying ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sponsors ENABLE ROW LEVEL SECURITY;

-- Create read policies for public access
CREATE POLICY "Public can read member_contributions" 
ON public.member_contributions 
FOR SELECT 
USING (true);

CREATE POLICY "Public can read member_lobbying" 
ON public.member_lobbying 
FOR SELECT 
USING (true);

CREATE POLICY "Public can read member_sponsors" 
ON public.member_sponsors 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_member_contributions_member_id ON public.member_contributions(member_id);
CREATE INDEX idx_member_lobbying_member_id ON public.member_lobbying(member_id);
CREATE INDEX idx_member_sponsors_member_id ON public.member_sponsors(member_id);