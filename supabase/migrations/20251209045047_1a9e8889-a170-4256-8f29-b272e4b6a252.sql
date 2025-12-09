-- Add unique constraint on votes table for congress, chamber, roll_number
ALTER TABLE public.votes ADD CONSTRAINT votes_congress_chamber_roll_unique UNIQUE (congress, chamber, roll_number);

-- Add unique constraint on member_votes table
ALTER TABLE public.member_votes ADD CONSTRAINT member_votes_vote_member_unique UNIQUE (vote_id, member_id);