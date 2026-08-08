# Product Stabilization Plan

This plan freezes broad brand renaming until the product flows are stable enough for production use.

## Brand rename freeze

Brand unify (2026-08-08) moved the UI kit to `@/components/Velora/...` and the cookie secret to `VELORA_COOKIE_SECRET` (legacy `SweetFlow_COOKIE_SECRET` dual-read). See [BRAND_UNIFY.md](./BRAND_UNIFY.md).

Still frozen for wire stability:

- Keep cookie names such as `sf_registered_device`, `sf_active_store`, and `sf_active_cashier`.
- Do not rename demo auth emails (`@CafeFlow.local`) without a coordinated reseed.
- Keep package, Supabase project, seed, and script names unchanged.

Surface-level copy can be adjusted when it improves user understanding, but it must not touch environment variables, cookie names, import paths, seed identifiers, or package names.

## Stabilization priorities

1. POS and device pairing UX, especially clear messaging when a register asks for pairing again.
2. Expiry and batch tracking flows.
3. Multi-organization onboarding and the local demo vs production setup boundary.
4. Security hardening and RLS verification.
5. Receipt and export behavior, including stable filenames and store branding.

## Later rename strategy

Handle rebranding as a separate project after stabilization:

1. Public display name and marketing copy.
2. Docs and demo data.
3. Receipt/export filenames.
4. Internal identifiers.
5. Environment variable and cookie migration with backwards compatibility.

Renaming environment variables or cookies must include a migration window where both old and new names are accepted.
