-- Create member_committees table for committee assignments
CREATE TABLE public.member_committees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  committee_code text NOT NULL,
  committee_name text NOT NULL,
  chamber text NOT NULL,
  rank integer,
  is_chair boolean DEFAULT false,
  is_ranking_member boolean DEFAULT false,
  congress integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(member_id, committee_code, congress)
);

-- Create member_statements table for press releases/statements
CREATE TABLE public.member_statements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title text NOT NULL,
  statement_date date NOT NULL,
  url text,
  statement_type text,
  subjects text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_statements ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public can read member_committees" 
ON public.member_committees 
FOR SELECT 
USING (true);

CREATE POLICY "Public can read member_statements" 
ON public.member_statements 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_member_committees_member_id ON public.member_committees(member_id);
CREATE INDEX idx_member_statements_member_id ON public.member_statements(member_id);
CREATE INDEX idx_member_statements_date ON public.member_statements(statement_date DESC);