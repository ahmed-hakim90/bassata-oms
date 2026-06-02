# مستخدمو التجربة (Demo) — SweetFlow

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

تأكد من وجود `NEXT_PUBLIC_SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` في `.env.local`.

---

## تسجيل الدخول (كل الحسابات)

| الحقل | القيمة |
|--------|--------|
| **كلمة مرور تسجيل الدخول** | `demo1234` |
| **رابط الدخول** | `/login` |

---

## الحسابات

| الاسم | البريد | الدور | الفروع | PIN (نقطة البيع) | ملاحظات |
|--------|--------|--------|--------|------------------|---------|
| Alex Owner | `owner@SweetFlow.local` | Owner | Downtown + Mall | — | صلاحيات كاملة، إعدادات، مستخدمين |
| Maya Manager | `manager@SweetFlow.local` | Manager | Downtown + Mall | — | إدارة يومية، جلسات، تقارير |
| Sam Cashier | `cashier1@SweetFlow.local` | Cashier | Downtown فقط | `1234` | كاشير Downtown — جلسة تجريبية مفتوحة |
| Jordan Cashier | `cashier2@SweetFlow.local` | Cashier | Mall فقط | `1234` | كاشير Mall — جلسة تجريبية مفتوحة |
| Riley Inventory | `inventory@SweetFlow.local` | Inventory | Downtown | — | مشتريات، مخزون، تحويلات |
| Pat Viewer | `viewer@SweetFlow.local` | Viewer | Downtown + Mall | — | قراءة فقط (بدون بيع) |

### ماذا يجرب كل دور؟

- **Owner / Manager:** لوحة التحكم، الإعدادات، المستخدمين، الأجهزة، فتح/إغلاق الجلسات، POS، التقارير.
- **Cashier:** `/login` → `/pos/start` → ربط الجهاز → PIN `1234` → بيع.
- **Inventory:** المشتريات، المخزون، الموردين (بدون POS).
- **Viewer:** تصفح فقط؛ لا يُنشئ طلبات ولا يفتح POS (حسب الصلاحيات).

---

## الفروع والأجهزة

| الفرع | المعرف (UUID قصير) | الجهاز | ملاحظة |
|--------|---------------------|--------|--------|
| Downtown | `…0101` | Register 1 | Sam Cashier + جلسة عادية (~3 ساعات) |
| Mall Location | `…0102` | Register 1 | Jordan Cashier + جلسة قريبة من التحذير (~21 ساعة) |

**ربط المتصفح بجهاز POS:**

1. سجّل دخولك كـ Owner أو Manager.
2. **Settings → Devices** → اختر الجهاز → **Register this browser**  
   أو أنشئ **Pairing code** من نفس الشاشة وافتح `/device/pair`.
3. افتح **Open POS** من الهيدر (`/pos/start` يختار فرع جلستك المفتوحة تلقائياً).

---

## جلسات تجريبية مسبقة (بعد `db reset`)

| الكاشير | الفرع | الحالة التقريبية |
|---------|--------|------------------|
| Sam Cashier | Downtown | جلسة نشطة عادية |
| Jordan Cashier | Mall | جلسة قريبة من حد التحذير |
| Maya Manager | Downtown | جلسة منتهية (لاختبار انتهاء الوردية) |

لتجربة POS كـ **Alex Owner:** سجّل دخولك، اربط الجهاز، افتح جلسة من **Sessions** أو **POS**، ثم **Open POS**.

---

## منتجات وبيانات إضافية

- فئات: Ice Cream, Drinks, Desserts, Toppings.
- باركود تجريبي: `100001` (Vanilla Scoop), `200001` (Iced Latte), …
- قوائم أونلاين: `/menu/downtown` و `/menu/mall-location` (من إعدادات الفرع).

---

## E2E / CI

متغيرات Playwright (اختياري):

```env
E2E_OWNER_EMAIL=owner@SweetFlow.local
E2E_PASSWORD=demo1234
```

---

## English summary

| Email | Password | Role | POS PIN |
|-------|----------|------|---------|
| owner@SweetFlow.local | demo1234 | owner | — |
| manager@SweetFlow.local | demo1234 | manager | — |
| cashier1@SweetFlow.local | demo1234 | cashier | 1234 |
| cashier2@SweetFlow.local | demo1234 | cashier | 1234 |
| inventory@SweetFlow.local | demo1234 | inventory | — |
| viewer@SweetFlow.local | demo1234 | viewer | — |

Org: **SweetFlow Demo** · Setup: `npm run db:reset-demo`
