# Pilot & Infrastructure Runbook

Phases 3–4 of [PRODUCT_EXECUTION_PLAN.md](./PRODUCT_EXECUTION_PLAN.md). Execute only after Feature Freeze ([MVP_FREEZE.md](./MVP_FREEZE.md)) and Stabilization (Phase 2).

## Phase 3 — Infrastructure checklist

- [ ] Dedicated **staging** Supabase project + Vercel preview/staging URL
- [ ] Staging env vars distinct from production (`SweetFlow_COOKIE_SECRET` unique)
- [ ] Production env vars present per [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ ] Supabase Auth Site URL + redirect URLs for staging and production
- [ ] SMTP / email provider for password reset
- [ ] Backups / PITR enabled on production Supabase plan
- [ ] Monitoring: Vercel logs (+ optional error tracker)
- [ ] Custom domain + SSL on production host
- [ ] Analytics (optional): product analytics only after privacy review — not a pilot blocker

Commands:

```bash
npm run verify:production
npm run smoke:check
```

Full ops list: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md).

## Phase 4 — Pilot rollout

### Scope

- **One** store/branch only
- Duration: **3–7 days** live operation
- Features: MVP IN list only; keep experimental flags off

### Before day 1

1. Complete Phase 2 smoke on staging with pilot org data shape
2. Onboard owner + cashiers; strong passwords (no demo defaults)
3. Pair registers; test cash sale + close session
4. Validate [DEVICE_MATRIX.md](./DEVICE_MATRIX.md) on pilot hardware
5. Confirm print path (USB or browser)
6. Document owner contact + rollback (redeploy previous Vercel deployment)

### During pilot

| Day | Focus |
|-----|--------|
| 1 | Open/close session, cash sales, receipts |
| 2–3 | Card/split, discounts, expenses, inventory receive |
| 4–5 | Refunds, transfers/waste if used, reports glance |
| 6–7 | Collect notes; triage P0/P1 only |

### Feedback log (copy per issue)

```text
Date:
Store:
Device/browser:
Severity: P0 | P1 | P2
Steps:
Expected:
Actual:
Screenshot/order #:
```

### Exit criteria to expand

- [ ] No open P0 after 72h of normal hours
- [ ] Cashiers can complete day without developer help
- [ ] Session close variance understood by manager
- [ ] Backup restore drill documented (even if tabletop)
- [ ] Credentials rotated if shared during setup
- [ ] `PLATFORM_BOOTSTRAP_EMAILS` narrowed

Then roll out additional branches using the same pairing + training checklist.
