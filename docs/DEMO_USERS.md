# مستخدمو التجربة (Demo) — CafeFlow / SweetFlow

> **للتطوير المحلي فقط.** لا تستخدم كلمات المرور هذه في الإنتاج.  
> البيانات تُحمَّل من [`supabase/seed.sql`](../supabase/seed.sql) وربط Auth من [`scripts/seed-auth.mjs`](../scripts/seed-auth.mjs).

## التجهيز السريع

```bash
npm run db:reset-demo   # supabase db reset + ربط حسابات Auth
npm run dev
```

أو يدوياً:

```bash
supabase db reset
npm run db:seed-auth
npm run dev
```

تأكد من وجود `NEXT_PUBLIC_SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` في `.env.local`  
(أو مرّر مفاتيح الـ local stack من `supabase status` عند التحقق ضد قاعدة محلية).

---

## تسجيل الدخول (كل الحسابات)

| الحقل | القيمة |
|--------|--------|
| **كلمة مرور تسجيل الدخول** | `demo1234` |
| **رابط الدخول** | `/login` |

Alias اختياري: `DEMO_PASSWORD` في البيئة (الافتراضي `demo1234`).

---

## الحسابات

| الاسم | البريد | الدور | الفروع | PIN (نقطة البيع) | ملاحظات |
|--------|--------|--------|--------|------------------|---------|
| Alex Owner | `owner@CafeFlow.local` | Owner | رئيسي + مول | — | صلاحيات كاملة؛ مطلوب لـ `verify:*` |
| Maya Manager | `manager@CafeFlow.local` | Manager | رئيسي + مول | — | إدارة يومية، جلسات، تقارير |
| Sam Cashier | `cashier1@CafeFlow.local` | Cashier | رئيسي فقط | `1234` | كاشير الفرع الرئيسي — E2E / P0 |
| Jordan Cashier | `cashier2@CafeFlow.local` | Cashier | مول فقط | `1234` | كاشير فرع المول |
| Riley Inventory | `inventory@CafeFlow.local` | Inventory | رئيسي | — | مشتريات، مخزون، تحويلات |
| Pat Viewer | `viewer@CafeFlow.local` | Viewer | رئيسي + مول | — | قراءة فقط (بدون بيع) |

> الأسماء القديمة `@SweetFlow.local` لم تعد تُنشأ بواسطة `seed-auth`. استخدم `@CafeFlow.local` فقط.

### ماذا يجرب كل دور؟

- **Owner / Manager:** لوحة التحكم، الإعدادات، المستخدمين، الأجهزة، فتح/إغلاق الجلسات، POS، التقارير.
- **Cashier:** `/login` → `/pos/start` → ربط الجهاز → PIN `1234` → بيع.
- **Inventory:** المشتريات، المخزون، الموردين (بدون POS).
- **Viewer:** تصفح فقط؛ لا يُنشئ طلبات ولا يفتح POS (حسب الصلاحيات).

---

## الفروع والأجهزة

| الفرع | المعرف (UUID قصير) | الجهاز | ملاحظة |
|--------|---------------------|--------|--------|
| الفرع الرئيسي | `…0101` | كاشير رئيسي (`…0301`) | Sam Cashier |
| فرع المول | `…0102` | كاشير المول (`…0302`) | Jordan Cashier — مطلوب لـ verify transfers |

**ربط المتصفح بجهاز POS:**

1. سجّل دخولك كـ Owner أو Manager.
2. **Settings → Devices** → اختر الجهاز → **Register this browser**  
   أو أنشئ **Pairing code** من نفس الشاشة وافتح `/device/pair`.
3. افتح **Open POS** من الهيدر (`/pos/start` يختار فرع جلستك المفتوحة تلقائياً).

---

## E2E / CI / verify

```env
E2E_OWNER_EMAIL=owner@CafeFlow.local
E2E_PASSWORD=demo1234
E2E_FULL_POS=1
# verify scripts default to the same emails/password
```

Scripts that expect these users: `verify:post-006`, `verify:p0-security`, `verify:inventory-crud`, `verify:supplier-payments`, Playwright `tests/e2e`.

Optional production admin (does **not** replace demo owner unless `ADMIN_EMAIL=owner@CafeFlow.local`):

```bash
ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='at-least-12-chars' npm run db:seed-auth
```

---

## English summary

| Email | Password | Role | POS PIN |
|-------|----------|------|---------|
| owner@CafeFlow.local | demo1234 | owner | — |
| manager@CafeFlow.local | demo1234 | manager | — |
| cashier1@CafeFlow.local | demo1234 | cashier | 1234 |
| cashier2@CafeFlow.local | demo1234 | cashier | 1234 |
| inventory@CafeFlow.local | demo1234 | inventory | — |
| viewer@CafeFlow.local | demo1234 | viewer | — |

Org seed id: `…0001` · Setup: `npm run db:reset-demo`
