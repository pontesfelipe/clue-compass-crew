-- Create policy area to issue mapping table
CREATE TABLE public.policy_area_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_area text NOT NULL UNIQUE,
  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  relevance_weight numeric NOT NULL DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policy_area_mappings ENABLE ROW LEVEL SECURITY;

-- Public can read mappings
CREATE POLICY "Public can read policy_area_mappings" 
ON public.policy_area_mappings 
FOR SELECT 
USING (true);

-- Add bill_impact column to bills table for AI-generated impact summaries
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS bill_impact text,
ADD COLUMN IF NOT EXISTS impact_generated_at timestamp with time zone;

-- Insert initial mappings based on Congress.gov policy areas to our issues
INSERT INTO public.policy_area_mappings (policy_area, issue_id, relevance_weight) VALUES
('Health', (SELECT id FROM issues WHERE slug = 'healthcare'), 1.0),
('Environmental Protection', (SELECT id FROM issues WHERE slug = 'climate'), 1.0),
('Energy', (SELECT id FROM issues WHERE slug = 'climate'), 0.8),
('Public Lands and Natural Resources', (SELECT id FROM issues WHERE slug = 'climate'), 0.6),
('Water Resources Development', (SELECT id FROM issues WHERE slug = 'climate'), 0.5),
('Immigration', (SELECT id FROM issues WHERE slug = 'immigration'), 1.0),
('Taxation', (SELECT id FROM issues WHERE slug = 'economy'), 0.9),
('Finance and Financial Sector', (SELECT id FROM issues WHERE slug = 'economy'), 0.8),
('Commerce', (SELECT id FROM issues WHERE slug = 'economy'), 0.7),
('Labor and Employment', (SELECT id FROM issues WHERE slug = 'economy'), 0.8),
('Economics and Public Finance', (SELECT id FROM issues WHERE slug = 'economy'), 0.9),
('Foreign Trade and International Finance', (SELECT id FROM issues WHERE slug = 'economy'), 0.6),
('Education', (SELECT id FROM issues WHERE slug = 'education'), 1.0),
('Crime and Law Enforcement', (SELECT id FROM issues WHERE slug = 'criminal-justice'), 1.0),
('Law', (SELECT id FROM issues WHERE slug = 'criminal-justice'), 0.7),
('Civil Rights and Liberties, Minority Issues', (SELECT id FROM issues WHERE slug = 'criminal-justice'), 0.8),
('Families', (SELECT id FROM issues WHERE slug = 'abortion'), 0.5),
('Social Welfare', (SELECT id FROM issues WHERE slug = 'economy'), 0.6);

-- Create index for faster lookups
CREATE INDEX idx_policy_area_mappings_policy_area ON public.policy_area_mappings(policy_area);
CREATE INDEX idx_policy_area_mappings_issue_id ON public.policy_area_mappings(issue_id);