#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Starting Supabase (if not running)…"
if command -v supabase >/dev/null 2>&1; then
  supabase start || true
  echo "→ Resetting database…"
  supabase db reset
  echo "→ Seeding auth users…"
  npm run db:seed-auth
  echo "→ Regenerating types…"
  npm run db:types || true
else
  echo "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "→ Starting Next.js dev server…"
npm run dev
