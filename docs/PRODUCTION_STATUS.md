# Production status

Last updated: 2026-06-02

## Done

| Item | Status |
|------|--------|
| Supabase project `pbpyxxplrlpcyljttnoa` | Linked |
| Migrations through `032_fix_pairing_anon_grants` | Applied |
| Vercel production | https://bassata-oms.vercel.app |
| Vercel env (production) | All 5 vars from `.env.example` |
| Automated verify scripts | Pass (owner@sweetflow.local) |
| Security fix: pairing RPC revoked from `PUBLIC`/`anon` | Migration `032` |

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

Org already exists on remote (demo users). For a clean production org, use `/onboarding` only on an empty DB — **do not** run `db:reset-demo` on this project.

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
