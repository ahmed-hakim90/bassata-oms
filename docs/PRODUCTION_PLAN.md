# خطة الإنتاج — SweetFlow POS

خطة عملية لنقل SweetFlow من بيئة التطوير إلى **Staging** ثم **Production**.

> **ترتيب التنفيذ الحالي (ملزم):** جودة الواجهة → اكتمال MVP + Feature Freeze → Stabilization (Smoke/Verify) → Infrastructure → Pilot.  
> المصدر التشغيلي: [PRODUCT_EXECUTION_PLAN.md](./PRODUCT_EXECUTION_PLAN.md) · [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) · [PERFORMANCE_BUDGET.md](./PERFORMANCE_BUDGET.md) · [ERROR_BUDGET.md](./ERROR_BUDGET.md) · [DEVICE_MATRIX.md](./DEVICE_MATRIX.md) · [MVP_FREEZE.md](./MVP_FREEZE.md)  
> **سلطة المعمارية:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · التنفيذ اليومي: [EXECUTION_PLAN.md](./EXECUTION_PLAN.md) · حالة الهجرات: [MIGRATION_AUDIT.md](./MIGRATION_AUDIT.md)  
> Go-live التشغيلي بعد الـ Freeze: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [SMOKE_TEST.md](./SMOKE_TEST.md)

---

## نظرة عامة

| المرحلة | الهدف | المدة المقدّرة |
|---------|--------|----------------|
| **0 — Product Quality** | UI/UX، Design System، shells، states، responsive | مستمر حتى اتساق الشاشات |
| **1 — Feature Complete + Freeze** | إكمال MVP وتجميد الميزات | 1–3 أيام مسح + ختم |
| **2 — Stabilization** | Smoke، verify، صلاحيات، POS، جلسات | 3–5 أيام |
| **3 — Infrastructure** | Staging، SMTP، backups، monitoring، domain | 1–2 يوم |
| **4 — Pilot → Production** | فرع واحد 3–7 أيام ثم التوسع | أسبوع+ |

**نطاق الإطلاق الأول (MVP):** POS يومي، مخزون، جلسات كاشير، تقارير أساسية، QR menu.  
**خارج النطاق (لاحقاً):** Offline/PWA، تقارير P&L كاملة، loyalty متقدم، SaaS billing — راجع [COMPLETION_PLAN.md](./COMPLETION_PLAN.md) و [MVP_FREEZE.md](./MVP_FREEZE.md).

---

## بوابة الكود (ضمن المرحلة 2 — Stabilization)

> لا تشغّل smoke شامل كامل أثناء موجات جودة الواجهة إلا فحصاً انتقائياً للشاشة المعدّلة.

### متطلبات قبل أي نشر

```bash
npm run verify:production   # smoke + all remote verify scripts
npm run smoke:check
```

يشمل: lint · typecheck · unit tests · build · التحقق من ملفات الهجرات · `SweetFlow_COOKIE_SECRET`.

### CI

- فرع `main` / PR يجب أن يمرّ workflow **quality-gate** (`.github/workflows/ci.yml`).
- E2E (`test:e2e`) اختياري — يُشغَّل يدوياً عبر `workflow_dispatch` أو محلياً قبل cutover.

### قائمة الهجرات (يجب تطبيقها بالترتيب)

طبّق **كل** ملفات `supabase/migrations/` عبر `supabase db push` (لا تتوقف عند قائمة يدوية).

| # | ملف / نطاق | ملاحظة |
|---|------------|--------|
| 001–023 | أساس + RBAC + tenants + AR | إلزامي |
| 025–029 | أمان P0 + split payments + landed cost | إلزامي |
| **030–031** | Souqna | **أُنشئت ثم حُذفت** في cleanup — **ليست live** (ADR-009). لا تعتمد عليها في الإنتاج |
| **032–038** | pairing / activity / inventory / RLS | إلزامي حيث وُجدت في المستودع |
| **039** | platform admin console | **أُنشئت ثم حُذفت** في cleanup — **ليست live** حتى ADR-001 / S01 |
| **cleanup** `20260612193243…` | إسقاط Souqna + platform_* + monthly_closes + online (مؤقتاً) | جزء من القطار — لا تحذف الملف |
| **20260618*** | استعادة online menu/orders | online orders **موجودة** بعد الاستعادة |
| لاحقاً | كل الهجرات المؤرّخة الأحدث | إلزامي |

> **010** متعمّد تخطّيه — لا فجوة وظيفية.  
> تفاصيل الحضور/الغياب: [MIGRATION_AUDIT.md](./MIGRATION_AUDIT.md).

```bash
supabase link --project-ref <staging-ref>
supabase db push
npm run db:types   # بعد تغيير schema على remote
```
---

## المرحلة 1 — Staging

### 1.1 إنشاء البيئة

| المكوّن | Staging | Production |
|---------|---------|------------|
| Supabase project | `sweetflow-staging` | `sweetflow-prod` |
| Vercel project / env | Preview أو branch deploy | Production domain |
| Domain | `staging.your-domain.com` | `app.your-domain.com` |

### 1.2 متغيرات البيئة

انسخ من `.env.example`:

| المتغير | Staging | Production |
|---------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ server-only | ✅ server-only |
| `SweetFlow_COOKIE_SECRET` | ✅ **قيمة مختلفة** عن prod | ✅ 32+ byte عشوائي |
| `NEXT_PUBLIC_APP_URL` | `https://staging...` | `https://app...` |
| `PLATFORM_BOOTSTRAP_EMAILS` | قائمة منفصلة عن prod | قائمة منفصلة — بوابة `/platform` |

**لا تشارك** `SUPABASE_SERVICE_ROLE_KEY` أو `SweetFlow_COOKIE_SECRET` بين staging و production.

### 1.3 Supabase Auth (Staging)

في **Authentication → URL configuration**:

- Site URL: `https://staging.your-domain.com`
- Redirect URLs:
  - `https://staging.your-domain.com/auth/callback`
  - `https://staging.your-domain.com/auth/callback?next=/reset-password`

### 1.4 Bootstrap على Staging

**لا تستخدم** `npm run db:reset-demo` على remote.

1. Deploy التطبيق
2. افتح `/onboarding` — أنشئ org + store + owner
3. أو (أتمتة): `node scripts/bootstrap-org.mjs --email ... --password '...' --org "..." --store "..."`

### 1.5 اختبارات Staging (إلزامية)

#### آلية

```bash
# على جهازك — ضبط env ليشير لـ staging
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export VERIFY_OWNER_EMAIL=owner@yourcompany.com
export VERIFY_OWNER_PASSWORD='...'

node scripts/verify-post-006.mjs
node scripts/verify-p0-security.mjs
node scripts/verify-inventory-crud.mjs
node scripts/verify-supplier-payments.mjs
```

#### يدوي

نفّذ **كامل** [SMOKE_TEST.md](./SMOKE_TEST.md) على staging وسجّل النتائج:

- [ ] POS: جلسة → بيع → refund → expense → إغلاق
- [ ] RBAC: cashier / inventory (و owner/manager)
- [ ] QR menu + online orders (first-party)
- [ ] ~~Monthly close~~ — **غير live** (أُزيل في cleanup)
- [ ] ~~Souqna~~ — **غير live** (أُزيل في cleanup؛ ADR-009)

**مخرجات المرحلة 1:** تقرير «فجوات staging» — أي bug يُصلَح قبل production.

---

## المرحلة 2 — Production infrastructure

### 2.1 Supabase Production

- [ ] مشروع Postgres **17+**
- [ ] `supabase link --project-ref <prod-ref>` ثم `supabase db push`
- [ ] تفعيل **Daily backups** + **PITR** (حسب الخطة)
- [ ] مراجعة **RLS** — لا policies مفتوحة على `service_role` في العميل

### 2.2 Vercel (أو host بديل)

```json
// vercel.json — موجود
"buildCommand": "npm run build"
```

1. Import المستودع
2. Environment variables → **Production** scope فقط للـ secrets
3. (موصى) Pre-deploy: `npm run smoke:check` في CI قبل merge

### 2.3 Supabase Auth (Production)

- Site URL: دومين الإنتاج
- Redirect URLs: `/auth/callback` + reset password
- [ ] **SMTP / Resend / SendGrid** لإيميل reset password

### 2.4 Feature flags — الإعداد الأولي

في Settings → System Features بعد onboarding:

| Flag | توصية الإطلاق |
|------|----------------|
| `credit_sales` | **OFF** حتى تدريب AR |
| `refunds`, `session_expenses` | ON بعد اختبار staging |
| `receipt_printing`, `cash_drawer` | حسب الأجهزة |
| Souqna / marketplace channels | **OFF** — غير live بعد cleanup (ADR-009) |

راجع [FEATURE_FLAGS.md](./FEATURE_FLAGS.md).

---

## المرحلة 3 — Cutover (يوم الإطلاق)

### جدول زمني مقترح

| الوقت | النشاط |
|-------|--------|
| T-24h | Freeze على `main` — PRs حرجة فقط |
| T-2h | `supabase db push` على prod (إن وُجدت هجرات جديدة) |
| T-1h | Deploy Vercel production |
| T0 | `/onboarding` — المالك ينشئ المنظمة |
| T+30m | إنشاء users + pairing أجهزة POS |
| T+1h | بيع تجريبي + إغلاق جلسة |
| T+2h | تفعيل QR menu / online orders إن مطلوب (ليس Souqna) |

### خطوات Cutover

1. **Deploy** آخر commit من فرع release
2. **Onboarding** — org، store، owner، flags
3. **Settings → Business** — عملة، ضريبة، branding
4. **Users** — manager + cashiers (كلمات مرور قوية)
5. **Devices** — pairing كل register
6. **Products / Inventory** — استيراد XLSX أو إدخال يدوي
7. **اختبار حي:** بيع نقدي → refund → close session
8. **Online (first-party):** تحقق من `/menu/[slug]` وطلبات Online Orders — **لا** إعداد Souqna (محذوف)

### Rollback

| السيناريو | الإجراء |
|-----------|---------|
| Deploy معطوب | Vercel → Promote previous deployment |
| هجرة DB خاطئة | استعادة PITR / backup — **لا** `db reset` على prod |
| بيانات org خاطئة | إصلاح يدوي أو bootstrap جديد على DB فارغ فقط |

---

## المرحلة 4 — Post go-live

### أسبوع 1

- [ ] مراقبة Vercel logs + Supabase logs يومياً
- [ ] راجع `PLATFORM_BOOTSTRAP_EMAILS` — قائمة منفصلة لكل بيئة؛ لا تشاركها بين staging و production
- [ ] تدوير أي credentials شُاركت أثناء الإعداد
- [ ] تدريب المالك: إغلاق جلسة الكاشير، feature flags، device pairing (ليس monthly close — غير live)
- [ ] توثيق جهة اتصال الدعم

### مراقبة (موصى)

| الأداة | الغرض |
|--------|--------|
| Vercel Analytics / Logs | أخطاء 5xx، بطء |
| Supabase Dashboard | Auth failures، DB CPU |
| (اختياري) Sentry | stack traces |

### صيانة دورية

- `supabase db push` عند كل release يحتوي migrations
- `npm run smoke:check` قبل merge إلى `main`
- مراجعة [COMPLETION_PLAN.md](./COMPLETION_PLAN.md) للميزات التالية

---

## Souqna — مؤجّل (ليس live)

Souqna migrations `030`/`031` ثم cleanup أسقط الجداول. **لا** checklist إنتاج لـ Souqna حتى موافقة منتج صريحة (ADR-009). القناة الحالية للطلبات أونلاين: first-party QR menu فقط.

---

## مصفوفة المسؤوليات (قالب)

| المهمة | المسؤول | الحالة |
|--------|---------|--------|
| Supabase prod + backups | | ☐ |
| Vercel env + domain | | ☐ |
| Auth SMTP | | ☐ |
| Staging smoke test | | ☐ |
| Production cutover | | ☐ |
| تدريب الكاشير | | ☐ |
| Platform control plane (بعد S01–S02) | | ☐ مؤجّل |

---

## أوامر مرجعية

```bash
# بوابة release
npm run smoke:check

# هجرات remote
supabase link --project-ref <ref>
supabase db push

# تحقق أمان (ضد staging/prod)
node scripts/verify-p0-security.mjs

# bootstrap بدون UI (اختياري)
node scripts/bootstrap-org.mjs \
  --email owner@example.com \
  --password 'StrongPass123!' \
  --org "Shop Name" \
  --store "Main Store"

# deploy
vercel --prod
```

---

## Definition of Done — الإنتاج جاهز عندما

- [ ] `npm run smoke:check` ينجح على فرع release
- [ ] CI quality-gate أخضر
- [ ] Staging: SMOKE_TEST كامل + verify scripts
- [ ] Production: Supabase + Vercel + Auth + secrets
- [ ] Onboarding + جهاز POS + بيع حقيقي ناجح
- [ ] Backups/PITR مفعّلة
- [ ] خطة rollback موثّقة
- [ ] المالك مدرب على الجلسات والصلاحيات (monthly close غير live)
