-- Replace partial unique index with full UNIQUE constraint so ON CONFLICT works
ALTER TABLE public.bills ADD CONSTRAINT bills_openstates_id_key UNIQUE (openstates_id);
DROP INDEX IF EXISTS public.idx_bills_openstates_unique;