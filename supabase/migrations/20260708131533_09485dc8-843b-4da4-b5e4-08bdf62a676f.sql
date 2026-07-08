-- Replace partial unique index on members.openstates_id with a full UNIQUE constraint
-- so that upsert(onConflict: 'openstates_id') works.
DROP INDEX IF EXISTS public.idx_members_openstates_unique;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_openstates_id_unique;
ALTER TABLE public.members ADD CONSTRAINT members_openstates_id_key UNIQUE (openstates_id);