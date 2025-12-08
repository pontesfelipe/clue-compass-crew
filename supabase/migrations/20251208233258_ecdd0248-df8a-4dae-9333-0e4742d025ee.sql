-- Create enum for chamber type
CREATE TYPE public.chamber_type AS ENUM ('house', 'senate');

-- Create enum for party type
CREATE TYPE public.party_type AS ENUM ('D', 'R', 'I', 'L');

-- Create enum for bill type
CREATE TYPE public.bill_type AS ENUM ('hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres');

-- Create enum for vote position
CREATE TYPE public.vote_position AS ENUM ('yea', 'nay', 'present', 'not_voting');

-- Members table
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bioguide_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  party party_type NOT NULL,
  state TEXT NOT NULL,
  district TEXT,
  chamber chamber_type NOT NULL,
  image_url TEXT,
  website_url TEXT,
  twitter_handle TEXT,
  in_office BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bills table
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congress INTEGER NOT NULL,
  bill_type bill_type NOT NULL,
  bill_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT,
  summary TEXT,
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  enacted BOOLEAN DEFAULT false,
  enacted_date DATE,
  policy_area TEXT,
  subjects TEXT[],
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(congress, bill_type, bill_number)
);

-- Bill sponsorships table (links members to bills they sponsor/cosponsor)
CREATE TABLE public.bill_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
  is_sponsor BOOLEAN DEFAULT false,
  is_original_cosponsor BOOLEAN DEFAULT false,
  cosponsored_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, bill_id)
);

-- Votes table (roll call votes)
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congress INTEGER NOT NULL,
  chamber chamber_type NOT NULL,
  session INTEGER NOT NULL,
  roll_number INTEGER NOT NULL,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  question TEXT,
  description TEXT,
  vote_date DATE NOT NULL,
  result TEXT,
  total_yea INTEGER,
  total_nay INTEGER,
  total_present INTEGER,
  total_not_voting INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(congress, chamber, session, roll_number)
);

-- Member votes table (how each member voted on each roll call)
CREATE TABLE public.member_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  vote_id UUID REFERENCES public.votes(id) ON DELETE CASCADE NOT NULL,
  position vote_position NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, vote_id)
);

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  home_state TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User scoring preferences table
CREATE TABLE public.user_scoring_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  productivity_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (productivity_weight >= 0 AND productivity_weight <= 1),
  attendance_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (attendance_weight >= 0 AND attendance_weight <= 1),
  bipartisanship_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (bipartisanship_weight >= 0 AND bipartisanship_weight <= 1),
  issue_alignment_weight DECIMAL(3,2) DEFAULT 0.25 CHECK (issue_alignment_weight >= 0 AND issue_alignment_weight <= 1),
  priority_issues TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Member scores table (pre-calculated scores)
CREATE TABLE public.member_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  productivity_score DECIMAL(5,2) DEFAULT 0,
  attendance_score DECIMAL(5,2) DEFAULT 0,
  bipartisanship_score DECIMAL(5,2) DEFAULT 0,
  issue_alignment_score DECIMAL(5,2) DEFAULT 0,
  overall_score DECIMAL(5,2) DEFAULT 0,
  bills_sponsored INTEGER DEFAULT 0,
  bills_cosponsored INTEGER DEFAULT 0,
  bills_enacted INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,
  votes_missed INTEGER DEFAULT 0,
  bipartisan_bills INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scoring_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_scores ENABLE ROW LEVEL SECURITY;

-- Public read access for congress data (members, bills, votes are public info)
CREATE POLICY "Public can read members" ON public.members FOR SELECT USING (true);
CREATE POLICY "Public can read bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Public can read bill_sponsorships" ON public.bill_sponsorships FOR SELECT USING (true);
CREATE POLICY "Public can read votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Public can read member_votes" ON public.member_votes FOR SELECT USING (true);

-- Public scores (no user_id) are readable by all, personal scores only by owner
CREATE POLICY "Public can read public scores" ON public.member_scores 
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- Profile policies
CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE USING (auth.uid() = user_id);

-- Scoring preferences policies
CREATE POLICY "Users can view own preferences" ON public.user_scoring_preferences 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_scoring_preferences 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_scoring_preferences 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_scoring_preferences_updated_at
  BEFORE UPDATE ON public.user_scoring_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.user_scoring_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_members_state ON public.members(state);
CREATE INDEX idx_members_chamber ON public.members(chamber);
CREATE INDEX idx_members_party ON public.members(party);
CREATE INDEX idx_members_bioguide ON public.members(bioguide_id);
CREATE INDEX idx_bills_congress ON public.bills(congress);
CREATE INDEX idx_bills_policy_area ON public.bills(policy_area);
CREATE INDEX idx_bill_sponsorships_member ON public.bill_sponsorships(member_id);
CREATE INDEX idx_bill_sponsorships_bill ON public.bill_sponsorships(bill_id);
CREATE INDEX idx_votes_bill ON public.votes(bill_id);
CREATE INDEX idx_member_votes_member ON public.member_votes(member_id);
CREATE INDEX idx_member_votes_vote ON public.member_votes(vote_id);
CREATE INDEX idx_member_scores_member ON public.member_scores(member_id);
CREATE INDEX idx_member_scores_user ON public.member_scores(user_id);