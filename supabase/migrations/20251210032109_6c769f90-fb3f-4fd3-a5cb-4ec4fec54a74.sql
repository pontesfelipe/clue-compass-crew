-- Create age_range enum type
CREATE TYPE public.age_range AS ENUM ('18-29', '30-44', '45-64', '65+');

-- Create issues table
CREATE TABLE public.issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issue_questions table
CREATE TABLE public.issue_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  dimension TEXT DEFAULT 'progressive_conservative',
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_issue_priorities table
CREATE TABLE public.user_issue_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  priority_level INTEGER NOT NULL DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, issue_id)
);

-- Create user_answers table
CREATE TABLE public.user_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.issue_questions(id) ON DELETE CASCADE,
  answer_value INTEGER NOT NULL CHECK (answer_value BETWEEN -2 AND 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- Create issue_signals table (maps votes/bills to issues)
CREATE TABLE public.issue_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('vote', 'bill_sponsorship', 'funding')),
  external_ref TEXT NOT NULL,
  direction INTEGER NOT NULL CHECK (direction IN (-1, 1)),
  weight NUMERIC NOT NULL DEFAULT 1.0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create politician_issue_positions table (cached scores)
CREATE TABLE public.politician_issue_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  politician_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  score_value NUMERIC NOT NULL DEFAULT 0 CHECK (score_value BETWEEN -2 AND 2),
  source_version INTEGER NOT NULL DEFAULT 1,
  data_points_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(politician_id, issue_id)
);

-- Create user_politician_alignment table (cached alignment scores)
CREATE TABLE public.user_politician_alignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  politician_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  overall_alignment NUMERIC NOT NULL CHECK (overall_alignment BETWEEN 0 AND 100),
  breakdown JSONB NOT NULL DEFAULT '{}',
  profile_version INTEGER NOT NULL DEFAULT 1,
  last_computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, politician_id)
);

-- Add alignment profile fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS age_range TEXT,
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_version INTEGER DEFAULT 1;

-- Enable RLS on all new tables
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_issue_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.politician_issue_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_politician_alignment ENABLE ROW LEVEL SECURITY;

-- Public read policies for reference data
CREATE POLICY "Public can read issues" ON public.issues FOR SELECT USING (true);
CREATE POLICY "Public can read issue_questions" ON public.issue_questions FOR SELECT USING (true);
CREATE POLICY "Public can read issue_signals" ON public.issue_signals FOR SELECT USING (true);
CREATE POLICY "Public can read politician_issue_positions" ON public.politician_issue_positions FOR SELECT USING (true);

-- User data policies
CREATE POLICY "Users can read own priorities" ON public.user_issue_priorities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own priorities" ON public.user_issue_priorities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own priorities" ON public.user_issue_priorities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own priorities" ON public.user_issue_priorities FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own answers" ON public.user_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.user_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.user_answers FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own alignment" ON public.user_politician_alignment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alignment" ON public.user_politician_alignment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alignment" ON public.user_politician_alignment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alignment" ON public.user_politician_alignment FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_issue_questions_issue_id ON public.issue_questions(issue_id);
CREATE INDEX idx_user_issue_priorities_user_id ON public.user_issue_priorities(user_id);
CREATE INDEX idx_user_answers_user_id ON public.user_answers(user_id);
CREATE INDEX idx_politician_issue_positions_politician_id ON public.politician_issue_positions(politician_id);
CREATE INDEX idx_politician_issue_positions_issue_id ON public.politician_issue_positions(issue_id);
CREATE INDEX idx_user_politician_alignment_user_id ON public.user_politician_alignment(user_id);
CREATE INDEX idx_user_politician_alignment_politician_id ON public.user_politician_alignment(politician_id);
CREATE INDEX idx_issue_signals_issue_id ON public.issue_signals(issue_id);

-- Seed initial issues
INSERT INTO public.issues (slug, label, description, icon_name, sort_order) VALUES
  ('climate', 'Climate & Environment', 'Environmental protection, climate change policy, and clean energy', 'leaf', 1),
  ('healthcare', 'Healthcare', 'Health insurance, Medicare, Medicaid, and healthcare access', 'heart-pulse', 2),
  ('immigration', 'Immigration', 'Border security, pathways to citizenship, and visa policies', 'globe', 3),
  ('economy', 'Economy & Jobs', 'Taxation, minimum wage, trade, and economic growth', 'trending-up', 4),
  ('guns', 'Gun Policy', 'Gun rights, background checks, and firearm regulations', 'shield', 5),
  ('abortion', 'Reproductive Rights', 'Abortion access and reproductive healthcare', 'heart', 6),
  ('education', 'Education', 'K-12 funding, student loans, and higher education access', 'graduation-cap', 7),
  ('criminal-justice', 'Criminal Justice', 'Police reform, sentencing, and prison reform', 'scale', 8);

-- Seed initial questions for each issue
INSERT INTO public.issue_questions (issue_id, question_text, weight, sort_order) VALUES
  ((SELECT id FROM public.issues WHERE slug = 'climate'), 'The federal government should increase regulations to reduce carbon emissions.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'climate'), 'Public investment in renewable energy should be significantly increased.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'healthcare'), 'The federal government should increase its role in providing health insurance coverage.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'healthcare'), 'Prescription drug prices should be regulated by the government.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'immigration'), 'Pathways to citizenship should be expanded for undocumented immigrants already in the U.S.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'immigration'), 'Border security funding should be significantly increased.', -1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'economy'), 'The federal minimum wage should be increased.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'economy'), 'Taxes on wealthy individuals and corporations should be raised.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'guns'), 'Federal gun laws should be stricter than they are today.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'guns'), 'Universal background checks should be required for all firearm sales.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'abortion'), 'Abortion should be legal in most cases.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'abortion'), 'The federal government should protect access to reproductive healthcare.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'education'), 'Federal funding for public K-12 education should be increased.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'education'), 'Student loan debt should be reduced or forgiven by the government.', 1.0, 2),
  ((SELECT id FROM public.issues WHERE slug = 'criminal-justice'), 'Police departments should be reformed to reduce use of force.', 1.0, 1),
  ((SELECT id FROM public.issues WHERE slug = 'criminal-justice'), 'Sentences for non-violent drug offenses should be reduced.', 1.0, 2);