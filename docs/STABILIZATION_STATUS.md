# Stabilization status (Phase 2)

Last automated run: **2026-07-11**

## Automated gate

```bash
npm run smoke:check
```

| Check | Result |
|-------|--------|
| lint (0 errors) | Pass |
| `tsc --noEmit` | Pass |
| unit tests (111) | Pass |
| `next build` | Pass |
| env / migrations sanity | Pass |
| `verify:rls-policies` (61 tables) | Pass |

## Still manual (before Phase 3 cutover)

Per [SMOKE_TEST.md](./SMOKE_TEST.md) and [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md):

- [ ] Full cashier day walkthrough on demo/staging DB
- [ ] Role redirects (cashier → POS)
- [ ] Pairing + session open/close
- [ ] Refund path
- [ ] Reports smoke glance
- [ ] Device matrix spot-check on pilot hardware

## Remote verify scripts

`npm run verify:production` (post-006, p0-security, inventory-crud, supplier-payments) requires valid demo/owner credentials against the linked Supabase project.

Last attempt (2026-07-11): smoke + RLS passed; `verify:post-006` failed with `Invalid login credentials` — fix seed/auth user before relying on remote verify scripts.

Run against the target environment before Pilot.

## Policy

No broad UI redesign during Stabilization — fixes only. Feature Freeze: [MVP_FREEZE.md](./MVP_FREEZE.md).
