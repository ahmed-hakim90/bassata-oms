# Custom domains (white-label)

Each **organization** may bind one hostname (e.g. `pos.client.com`) that serves admin, POS, and `/menu` with that tenant’s identity.

## DNS (customer)

1. Add a **CNAME** from the customer hostname to the Velora Vercel deployment host  
   (or A/ALIAS per Vercel domain docs for apex domains).
2. In `/platform` → org detail → Custom domain: enter hostname → **Save** → **Verify**.
3. Add the same origin to **Supabase Auth → Redirect URLs**.
4. Add the hostname in **Vercel → Project → Domains** (SSL automatic).

## Status values

| Status | Meaning |
|--------|---------|
| `none` | No domain configured |
| `pending_dns` | Saved; awaiting DNS / Vercel |
| `verifying` | Verification in progress |
| `active` | Host resolves to this org; traffic allowed |
| `error` | Verification failed |

## Security

- Unverified hosts do **not** establish tenant context.
- Suspended orgs reject custom-domain entry with a clear Arabic message.
- Users from org A cannot use org B’s domain (session org must match host org).
- Platform reserved hosts (`NEXT_PUBLIC_APP_URL` host, `*.vercel.app` app host) cannot be claimed.

## Env

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_APP_URL` | Platform canonical host (onboarding, fallback links) |
| `PLATFORM_RESERVED_HOSTS` | Optional comma-separated extra reserved hostnames |

## Operator smoke

1. Set domain on a test org → verify → open `https://<domain>/login`.
2. Login as that org’s owner → dashboard shows only that org.
3. Open `https://<domain>/menu` → catalog for that org’s default store.
4. Suspend org → custom domain shows suspended message.

## Reference scale (supermarket)

Device registry: `/devices` → enable **ميزان مرجعي** on the paired terminal.

| Protocol | Behavior |
|----------|----------|
| `manual` (default) | Operator enters weight in POS weight modal — supported path |
| `usb_serial_stub` | Hook reserved for a future certified Web Serial device; falls back to manual |

Do not claim multi-vendor scale support until a single reference device is documented here with baud/protocol notes.
