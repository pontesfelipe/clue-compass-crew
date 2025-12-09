-- Add unique constraint on bills for upsert
ALTER TABLE public.bills 
ADD CONSTRAINT bills_congress_type_number_unique 
UNIQUE (congress, bill_type, bill_number);

-- Add unique constraint on bill_sponsorships for upsert
ALTER TABLE public.bill_sponsorships 
ADD CONSTRAINT bill_sponsorships_bill_member_unique 
UNIQUE (bill_id, member_id);