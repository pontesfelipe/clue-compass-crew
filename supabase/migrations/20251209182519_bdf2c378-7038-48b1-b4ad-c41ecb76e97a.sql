-- Create table for AI-generated member summaries
CREATE TABLE public.member_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

-- Enable RLS
ALTER TABLE public.member_summaries ENABLE ROW LEVEL SECURITY;

-- Public can read summaries
CREATE POLICY "Public can read member_summaries" 
ON public.member_summaries 
FOR SELECT 
USING (true);