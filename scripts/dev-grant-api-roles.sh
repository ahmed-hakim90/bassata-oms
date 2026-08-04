#!/usr/bin/env bash
#
# Dev-only helper: mirror Supabase cloud's default table/sequence/function grants
# for the API roles (anon, authenticated, service_role) on the local stack.
#
# Why this is needed:
#   `supabase db reset` runs the migrations as the `postgres` role. On some
#   Supabase CLI versions the `postgres` role's DEFAULT PRIVILEGES for schema
#   `public` only grant TRUNCATE/REFERENCES/TRIGGER to anon/authenticated/
#   service_role — NOT SELECT/INSERT/UPDATE/DELETE. That breaks every PostgREST
#   query the app makes (you'll see: "permission denied for table <name>").
#   In Supabase cloud these roles get ALL by default, so the app relies on it.
#
# This script re-grants ALL on existing objects and fixes DEFAULT PRIVILEGES so
# later objects are covered too. All public tables have RLS enabled, so row
# access is still gated by policies — this only restores table-level grants.
#
# Idempotent. Run it AFTER `supabase db reset` (and before/around `db:seed-auth`).
set -euo pipefail

DBC="$(docker ps --format '{{.Names}}' | grep -i 'supabase_db' | head -1)"
if [ -z "${DBC}" ]; then
  echo "Could not find a running supabase_db_* container. Run 'supabase start' first." >&2
  exit 1
fi

docker exec -i "${DBC}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL

echo "→ API-role grants applied on ${DBC}"
