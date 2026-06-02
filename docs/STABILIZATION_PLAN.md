# Product Stabilization Plan

This plan freezes broad brand renaming until the product flows are stable enough for production use.

## Brand rename freeze

Do not rename internal SweetFlow identifiers during stabilization:

- Keep `SweetFlow_COOKIE_SECRET` unchanged.
- Keep cookie names such as `sf_registered_device`, `sf_active_store`, and `sf_active_cashier`.
- Keep component import paths such as `@/components/SweetFlow/...`.
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
