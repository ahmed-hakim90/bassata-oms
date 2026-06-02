# خطة الإنتاج — SweetFlow POS

خطة عملية لنقل SweetFlow من بيئة التطوير إلى **Staging** ثم **Production**.  
مرجع سريع: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [SMOKE_TEST.md](./SMOKE_TEST.md)

---

## نظرة عامة

| المرحلة | الهدف | المدة المقدّرة |
|---------|--------|----------------|
| **0 — بوابة الكود** | فرع release يمرّ `smoke:check` و CI | 1–2 يوم |
| **1 — Staging** | بيئة معزولة + اختبار يدوي كامل | 3–5 أيام |
| **2 — Production infra** | Supabase + Vercel + Auth + secrets | 1–2 يوم |
| **3 — Cutover** | onboarding + أجهزة POS + بيع تجريبي | 1 يوم |
| **4 — Post go-live** | مراقبة + تدوير secrets + تدريب | أسبوع 1 |

**نطاق الإطلاق الأول (MVP):** POS يومي، مخزون، جلسات كاشير، تقارير أساسية، QR menu.  
**خارج النطاق (لاحقاً):** تقارير P&L كاملة، loyalty متقدم، SaaS billing — راجع [COMPLETION_PLAN.md](./COMPLETION_PLAN.md).

---

## المرحلة 0 — بوابة الكود (Release gate)

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

| # | ملف | ملاحظة |
|---|-----|--------|
| 001–023 | أساس + RBAC + tenants + AR | إلزامي |
| 025–029 | أمان P0 + split payments + landed cost | إلزامي |
| **030** | `souqna_integration.sql` | إذا تستخدم Souqna |
| **031** | `souqna_provider_completion.sql` | إذا تستخدم Souqna |
| **032** | `fix_pairing_anon_grants.sql` | إلزامي — إصلاح أمان pairing |

> **010** متعمّد تخطّيه — لا فجوة وظيفية.

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
| `PLATFORM_BOOTSTRAP_EMAILS` | بريد الفريق | بريد المالك فقط — أزل لاحقاً |

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
- [ ] RBAC: cashier / viewer / inventory
- [ ] Monthly close يمنع التعديلات
- [ ] QR menu + online orders
- [ ] (اختياري) Souqna: API key + webhook + استيراد طلب

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
| Souqna channel | ON فقط بعد staging ناجح |

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
| T+2h | تفعيل Souqna / QR (إن مطلوب) |

### خطوات Cutover

1. **Deploy** آخر commit من فرع release
2. **Onboarding** — org، store، owner، flags
3. **Settings → Business** — عملة، ضريبة، branding
4. **Users** — manager + cashiers (كلمات مرور قوية)
5. **Devices** — pairing كل register
6. **Products / Inventory** — استيراد XLSX أو إدخال يدوي
7. **اختبار حي:** بيع نقدي → refund → close session
8. **Souqna** (إن مفعّل):
   - `NEXT_PUBLIC_APP_URL` = دومين prod
   - Settings → Souqna → regenerate API key
   - تسجيل webhook URL في Souqna
   - Publish products + test order import

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
- [ ] إزالة / تضييق `PLATFORM_BOOTSTRAP_EMAILS`
- [ ] تدوير أي credentials شُاركت أثناء الإعداد
- [ ] تدريب المالك: monthly close، feature flags، device pairing
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

## Souqna — checklist إضافي

- [ ] Migrations `030` + `031` على prod
- [ ] `NEXT_PUBLIC_APP_URL` يطابق الدومين العام
- [ ] API key + webhook secret في Settings (لا تُ commit)
- [ ] `allowed_store_id` يطابق المتجر الصحيح
- [ ] Test: `testSouqnaApiKeyAction` من Settings
- [ ] Publish products → verify count في stats tab
- [ ] طلب تجريبي من Souqna → يظهر في Online Orders

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
| Souqna webhook | | ☐ |

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
- [ ] المالك مدرب على الإغلاق الشهري والصلاحيات
