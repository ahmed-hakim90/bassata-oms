# Production status

Last updated: 2026-06-02

## Done

| Item | Status |
|------|--------|
| Supabase project `pbpyxxplrlpcyljttnoa` | Linked |
| Local migration set through `038_simplify_shelf_life_model` | Present and required |
| Vercel production | https://bassata-oms.vercel.app |
| Vercel env (production) | All 5 vars from `.env.example` |
| Automated verify scripts | Pass (owner@sweetflow.local) |
| Security fix: pairing RPC revoked from `PUBLIC`/`anon` | Migration `032` |
| P0 RLS/audit append-only hardening | Migration `037` required |
| Simplified shelf-life product model | Migration `038` required |

## You must do manually

### Supabase Auth → URL configuration

In [Supabase Dashboard](https://supabase.com/dashboard/project/pbpyxxplrlpcyljttnoa/auth/url-configuration):

- **Site URL:** `https://bassata-oms.vercel.app`
- **Redirect URLs:**
  - `https://bassata-oms.vercel.app/auth/callback`
  - `https://bassata-oms.vercel.app/auth/callback?next=/reset-password`

### Email (password reset)

Configure SMTP or Supabase built-in mail in **Authentication → Email**.

### First login

Before cutover, confirm the linked production database has migrations through `038` applied. Org already exists on remote (demo users). For a clean production org, use `/onboarding` only on an empty DB — **do not** run `db:reset-demo` on this project.

Current owner: `owner@sweetflow.local` (password from your seed-auth setup).

### Souqna

- `NEXT_PUBLIC_APP_URL` on Vercel = `https://bassata-oms.vercel.app`
- Configure API key in **Settings → Souqna** after login

## Commands

```bash
npm run vercel:env      # push .env.local → Vercel production
npm run vercel:deploy   # production deploy
npm run verify:production  # smoke + DB verify scripts
```

## Production URL

https://bassata-oms.vercel.app
