-- Drop existing constraint and add expanded one
ALTER TABLE member_contributions DROP CONSTRAINT IF EXISTS member_contributions_contributor_type_check;

ALTER TABLE member_contributions ADD CONSTRAINT member_contributions_contributor_type_check 
  CHECK (contributor_type IN ('individual', 'pac', 'organization', 'corporate', 'union', 'party', 'candidate', 'other'));