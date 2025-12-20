-- Add FEC entity type fields to member_contributions
ALTER TABLE public.member_contributions 
ADD COLUMN IF NOT EXISTS entity_type text,
ADD COLUMN IF NOT EXISTS entity_type_desc text;

-- Add index for filtering by entity type
CREATE INDEX IF NOT EXISTS idx_member_contributions_entity_type 
ON public.member_contributions(entity_type);