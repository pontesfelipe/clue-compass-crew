-- Create governors table
CREATE TABLE public.governors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  party TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  image_url TEXT,
  email TEXT,
  website_url TEXT,
  twitter_handle TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  term_start DATE,
  term_end DATE,
  is_current BOOLEAN DEFAULT true,
  capitol_phone TEXT,
  capitol_address TEXT,
  openstates_id TEXT UNIQUE,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.governors ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read governors" 
ON public.governors 
FOR SELECT 
USING (true);

-- Create index for state lookup
CREATE INDEX idx_governors_state ON public.governors(state);
CREATE INDEX idx_governors_party ON public.governors(party);

-- Add trigger for updated_at
CREATE TRIGGER update_governors_updated_at
BEFORE UPDATE ON public.governors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();