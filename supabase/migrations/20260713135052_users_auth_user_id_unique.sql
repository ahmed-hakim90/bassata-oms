-- S04 / ADR-003: UNIQUE (users.auth_user_id)
-- Audit (2026-07-13, linked remote): zero duplicate non-null auth_user_id rows.
-- Cleanup query if needed before re-run:
--   SELECT auth_user_id, COUNT(*), array_agg(id), array_agg(email), array_agg(org_id)
--   FROM public.users
--   WHERE auth_user_id IS NOT NULL
--   GROUP BY auth_user_id
--   HAVING COUNT(*) > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id IS NOT NULL
    GROUP BY auth_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE(users.auth_user_id): duplicate non-null auth_user_id rows exist. Clean up first (see migration comment).';
  END IF;
END $$;

-- Replace non-unique lookup index with UNIQUE constraint (Postgres allows multiple NULLs).
DROP INDEX IF EXISTS public.idx_users_auth_user_id;

ALTER TABLE public.users
  ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
