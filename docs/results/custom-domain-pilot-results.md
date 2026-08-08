# Custom domain pilot results

**Date:** 2026-08-08  
**Plan:** Top 5 gaps — P3  
**Refs:** [CUSTOM_DOMAINS.md](../CUSTOM_DOMAINS.md), `src/proxy.ts`, Platform custom-domain panel

## Automated / code readiness

| Check | Result |
|-------|--------|
| Migration `org_custom_domains` applied (remote) | **Pass** (prior session) |
| Hostname normalize / reserved / unique rules unit tests | **Pass** |
| Cross-tenant host deny unit test (`assertUserMatchesHostOrg`) | **Pass** |
| Suspended / unverified host → `/domain-unavailable` in proxy | **Code present** |
| Platform set/verify/clear domain + plan `allow_custom_domain` | **Code present** |

## Live pilot (one staging org)

| Step | Status |
|------|--------|
| Assign hostname on staging org in `/platform` | **Not run** (needs customer DNS) |
| CNAME + Vercel Domains + SSL | **Not run** |
| Supabase Auth redirect for that host | **Not run** |
| Verify → `active` | **Not run** |
| Login on custom host → org data only | **Not run** |
| `/menu` on custom host | **Not run** |
| Suspend org → unavailable | **Not run** |
| Other org user → tenant deny | **Not run** |

## Operator sign-off

| Field | Value |
|-------|-------|
| Pilot hostname | _pending_ |
| Org id | _pending_ |
| Operator | _pending_ |
| Date | _pending_ |

Code path is ready; treat feature as **pilot-ready**, not **customer-live**, until the live table is Pass.
