import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  CreditCard,
  Heart,
  Landmark,
  LockKeyhole,
  Package,
  QrCode,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Users,
  Warehouse,
  Workflow,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "شرح المنصة",
  description:
    "شرح احترافي لمنصة SweetFlow POS وما تقدمه لأصحاب الأعمال في البيع والمخزون والفروع والتقارير.",
};

const painPoints = [
  "الكاشير يبيع، والمخزون يتأخر في التحديث.",
  "المدير لا يعرف فرق الدرج إلا في آخر اليوم.",
  "الموردين والمشتريات والمصروفات في ملفات متفرقة.",
  "كل نشاط له طريقة بيع مختلفة، لكن النظام القديم يعاملهم كأنهم نفس الشيء.",
];

const outcomes = [
  {
    label: "قرار أسرع",
    value: "لوحة واحدة",
    detail: "مبيعات اليوم، الجلسات المفتوحة، المنتجات الأعلى، والتنبيهات الحرجة.",
  },
  {
    label: "رقابة أوضح",
    value: "صلاحيات دقيقة",
    detail: "كل مستخدم يرى ويعمل ما يناسب دوره، مع سجل مراجعة للإجراءات الحساسة.",
  },
  {
    label: "تشغيل أهدأ",
    value: "تدفق مترابط",
    detail: "البيع يخصم المخزون، والمشتريات تضيفه، والهالك والجرد يصححان الصورة.",
  },
];

const capabilityGroups = [
  {
    icon: ShoppingCart,
    title: "نقطة بيع مصممة للتشغيل اليومي",
    text: "واجهة لمس سريعة، بحث وباركود، اختيارات وأحجام، وزن أو بيع بالمبلغ، وربط عميل قبل الدفع.",
  },
  {
    icon: Receipt,
    title: "طلبات ومدفوعات واضحة",
    text: "نقدي، كارت، محفظة، آجل، خصومات، مرتجعات، إلغاء، وإيصالات قابلة للتخصيص.",
  },
  {
    icon: Clock,
    title: "جلسات كاشير وانضباط درج",
    text: "فتح وردية، رصيد بداية، مصروفات جلسة، تحذير انتهاء، إغلاق ومطابقة نقدية.",
  },
  {
    icon: Warehouse,
    title: "مخزون لكل فرع ومخزن",
    text: "مستويات مخزون، حد إعادة طلب، حركات كاملة، باتش، صلاحية، سيريال، وطرق FIFO أو FEFO.",
  },
  {
    icon: Truck,
    title: "مشتريات وموردين",
    text: "فواتير موردين، استلام مخزون، سجل أسعار، حساب مورد، وتسجيل دفعات.",
  },
  {
    icon: ArrowLeftRight,
    title: "تحويلات بين الفروع",
    text: "إرسال من مخزن واستلام في الوجهة مع عكس الحركة عند الإلغاء.",
  },
  {
    icon: Trash2,
    title: "هالك وفاقد",
    text: "تسجيل تالف أو منتهي أو انسكاب، واحتساب تكلفة الهالك على التقارير.",
  },
  {
    icon: ClipboardList,
    title: "جرد وتسويات",
    text: "جرد دوري، مقارنة الفعلي بالنظام، وترحيل فروقات كمستند واضح.",
  },
  {
    icon: Users,
    title: "عملاء وحسابات",
    text: "ملفات عملاء، سجل طلبات، حساب عميل، تحصيل دفعات، وبيع آجل عند تفعيله.",
  },
  {
    icon: Heart,
    title: "ولاء ونقاط",
    text: "قواعد كسب واستبدال، سجل نقاط، واسترداد يدوي من داخل تجربة العميل.",
  },
  {
    icon: Landmark,
    title: "مصروفات ومراكز تكلفة",
    text: "مصروف عام أو مصروف جلسة، تصنيفات، مراكز تكلفة، وموافقات حسب السياسة.",
  },
  {
    icon: BarChart3,
    title: "تقارير للإدارة",
    text: "مبيعات، ربحية، مخزون، مصروفات، جلسات، منتجات أعلى ربحا أو تكلفة.",
  },
];

const journeys = [
  {
    icon: Receipt,
    title: "رحلة الطلب",
    steps: ["اختيار المنتجات", "ربط العميل", "تحديد طريقة الدفع", "طباعة الإيصال", "تحديث التقارير"],
  },
  {
    icon: Package,
    title: "رحلة المخزون",
    steps: ["شراء من مورد", "استلام في مخزن", "خصم عند البيع", "تسجيل هالك", "جرد وتصحيح"],
  },
  {
    icon: Building2,
    title: "إدارة الفروع",
    steps: ["فروع ومخازن", "أجهزة POS", "صلاحيات وصول", "تحويلات", "مقارنة الأداء"],
  },
  {
    icon: BarChart3,
    title: "الرقابة والأرقام",
    steps: ["جلسات مفتوحة", "فروق الدرج", "مصروفات", "إقفالات شهرية", "Audit logs"],
  },
];

const activityPresets = [
  {
    type: "كافيه",
    category: "نوع نشاط",
    summary: "بيع سريع مع أحجام وإضافات ووصفات للمشروبات، وتتبع خامات وصلاحية عند الحاجة.",
    settings: ["Retail", "Variants", "Recipes", "FIFO", "Session expenses"],
  },
  {
    type: "آيس كريم",
    category: "نوع نشاط",
    summary: "مكونات ووصفات وتكلفة دقيقة مع FEFO وباتش وصلاحية لحماية الجودة وتقليل الهالك.",
    settings: ["Recipes", "Batch + expiry", "FEFO", "Block expired sale", "Waste cost"],
  },
  {
    type: "مطعم",
    category: "نوع نشاط",
    summary: "تكلفة طبق من المكونات، شراء خامات، متابعة صلاحية، وربط المبيعات بحركة المخزون.",
    settings: ["Ingredients", "Recipe costing", "FEFO", "Purchases", "Suppliers"],
  },
  {
    type: "مخبز / حلواني",
    category: "نوع نشاط",
    summary: "إنتاج يومي، وصفات، صلاحية قصيرة، هالك آخر اليوم، وتكلفة دقيقة للمنتجات الجاهزة.",
    settings: ["Recipes", "Short shelf life", "FEFO", "Daily waste", "Packaging"],
  },
  {
    type: "عصائر",
    category: "نوع نشاط",
    summary: "أحجام ومكونات سريعة الاستهلاك مع وصفات وصلاحية قصيرة للفاكهة والخامات.",
    settings: ["Variants", "Recipes", "Batch + expiry", "FEFO", "Fresh ingredients"],
  },
  {
    type: "سوبرماركت",
    category: "نوع نشاط",
    summary: "باركود، وزن، بيع بالمبلغ، جملة، مستويات أسعار، وباتش وصلاحية للأصناف الحساسة.",
    settings: ["Barcode", "Weight sales", "Price by amount", "Wholesale", "Price tiers"],
  },
  {
    type: "ألبان / لحوم / طازج",
    category: "نوع نشاط",
    summary: "بيع بالوزن أو بالمبلغ، صلاحية صارمة، FEFO، وتتبع باتش للمنتجات الحساسة.",
    settings: ["Weight", "Price by amount", "Batch + expiry", "FEFO", "Block expired sale"],
  },
  {
    type: "ملابس وأحذية",
    category: "نوع نشاط",
    summary: "منتجات بمقاسات وألوان وموديلات، مخزون قياسي، وباركود لكل SKU.",
    settings: ["Variants", "SKU", "Barcode", "Standard stock", "Returns"],
  },
  {
    type: "إلكترونيات",
    category: "نوع نشاط",
    summary: "تتبع serial أو IMEI، ضمان، مرتجعات، ومخزون دقيق للقطع عالية القيمة.",
    settings: ["Serial number", "Warranty", "SKU", "Barcode", "Returns"],
  },
  {
    type: "مستحضرات تجميل",
    category: "نوع نشاط",
    summary: "باركود، باتش وصلاحية، أحجام مختلفة، وتحذيرات للمنتجات القريبة من الانتهاء.",
    settings: ["Batch + expiry", "FEFO", "Variants", "Barcode", "Near expiry"],
  },
  {
    type: "مكتبة / أدوات مدرسية",
    category: "نوع نشاط",
    summary: "SKU وباركود ومخزون قياسي لأصناف كثيرة وسريعة الحركة.",
    settings: ["SKU", "Barcode", "Standard stock", "Purchases", "Stock count"],
  },
  {
    type: "تجزئة",
    category: "نموذج بيع",
    summary: "SKU وباركود ومخزون قياسي، مع دعم السيريال للمنتجات التي تحتاج تتبع فردي.",
    settings: ["SKU", "Standard stock", "Serial tracking", "FIFO", "Returns"],
  },
  {
    type: "جملة",
    category: "نموذج بيع",
    summary: "وضع جملة افتراضي، كميات كبيرة، أسعار متعددة، وتتبع باتش مناسب لحركة المخزون الكبيرة.",
    settings: ["Wholesale default", "Tiers", "Batch tracking", "Cashier wholesale", "Quantity rules"],
  },
  {
    type: "مختلط",
    category: "تجميع نماذج",
    summary: "يجمع التجزئة والجملة والوزن والبيع بالمبلغ لنشاط له أكثر من نموذج بيع.",
    settings: ["Retail + wholesale", "Weight", "Price by amount", "Variants", "Flexible templates"],
  },
];

const settingsSections = [
  {
    icon: Store,
    title: "بيانات الشركة والفروع",
    items: ["اسم النشاط والشعار", "العملة والمنطقة الزمنية", "الفروع والمخازن", "أجهزة POS"],
  },
  {
    icon: CreditCard,
    title: "POS والإيصالات والدفع",
    items: ["طرق الدفع", "الضريبة", "نهاية الإيصال", "طباعة الإيصال ودرج الكاش"],
  },
  {
    icon: Settings2,
    title: "خصائص النظام",
    items: ["تفعيل أو إخفاء الوحدات", "المشتريات والتحويلات والهالك", "الجرد والإقفالات", "الأونلاين والتكاملات"],
  },
  {
    icon: Clock,
    title: "الجلسات والوردية",
    items: ["مدة فتح الجلسة", "تحذير قبل الانتهاء", "منع البيع عند الانتهاء", "إغلاق إجباري للمدير"],
  },
  {
    icon: Landmark,
    title: "المصروفات ومراكز التكلفة",
    items: ["اعتماد المصروفات", "مصروفات الكاشير", "مصروف شراء من الجلسة", "منع المصروف في فترة مغلقة"],
  },
  {
    icon: ShieldCheck,
    title: "المستخدمون والصلاحيات",
    items: ["Owner وManager وCashier", "صلاحيات مخصصة", "صلاحيات فروع", "PIN للكاشير"],
  },
  {
    icon: QrCode,
    title: "QR وSouqna",
    items: ["منيو QR للفرع", "طلبات أونلاين", "نشر منتجات", "Webhook واستيراد طلبات"],
  },
  {
    icon: ScrollText,
    title: "المراجعة والإقفالات",
    items: ["Audit logs", "لقطات شهرية", "قفل فترة", "إعادة فتح بصلاحية"],
  },
];

const proofPoints = [
  "المبيعات والمخزون والمحاسبة الخفيفة داخل نفس التدفق.",
  "كل نشاط له preset واقعي بدل إعدادات عامة مربكة.",
  "التقارير لا تنتظر آخر الشهر، لأنها تتغذى من التشغيل اليومي.",
  "الصلاحيات والـ audit تجعل النمو بين الفروع أكثر قابلية للسيطرة.",
];

function SectionIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-muted-foreground">{text}</p>
    </div>
  );
}

export default function LangingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative isolate overflow-hidden">
        <Image
          src="/marketing/sweetflow-hero.png"
          alt="لوحة تشغيل حديثة تجمع نقطة البيع والمخزون والتقارير"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/88 to-background/22" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto flex min-h-[88svh] max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/langing-page" className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-5" />
              </span>
              <span className="text-lg font-semibold">{APP_NAME}</span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#story" className="hover:text-foreground">
                القصة
              </a>
              <a href="#activities" className="hover:text-foreground">
                الأنشطة
              </a>
              <a href="#settings" className="hover:text-foreground">
                الإعدادات
              </a>
            </nav>
          </header>

          <div className="flex flex-1 items-center">
            <div className="max-w-3xl py-16">
              <p className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-background/80 px-3 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
                <BadgeCheck className="size-4" />
                منصة تشغيل كاملة للفروع والمبيعات والمخزون
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.15] text-foreground md:text-6xl">
                {APP_NAME}
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-9 text-foreground/82 md:text-2xl">
                النظام الذي يحول يوم العمل من أوراق وملفات ورسائل متفرقة إلى قصة تشغيل واحدة:
                بيع، مخزون، ورديات، عملاء، مصروفات، وتقارير يعرف منها صاحب البيزنس ماذا يحدث الآن.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                >
                  ابدأ التشغيل
                </Link>
                <Link
                  href="/pos"
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background/80 px-6 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-muted"
                >
                  افتح نقطة البيع
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-4">
          {painPoints.map((point) => (
            <div key={point} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <LockKeyhole className="mb-4 size-5 text-destructive" />
              <p className="text-sm leading-7 text-card-foreground">{point}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary">قبل وبعد</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
              المنصة لا تضيف شاشة جديدة فقط، بل تربط قرارات اليوم ببعضها.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              عندما يبيع الكاشير، يعرف المخزون. عندما يستلم المدير مشتريات، تظهر التكلفة.
              عندما يغلق الفرع الجلسة، تظهر الفروق. وعندما يراجع صاحب النشاط التقارير،
              يرى صورة مبنية على أحداث حقيقية لا على تجميع يدوي.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {outcomes.map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionIntro
            eyebrow="كل ما يحتاجه التشغيل"
            title="من البيع للربحية في نفس النظام"
            text="SweetFlow يجمع الوحدات التي يستخدمها صاحب البيزنس يوميا، بدون فصل مصطنع بين الكاشير والمخزن والمحاسبة الخفيفة والإدارة."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilityGroups.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border border-border bg-background p-5">
                  <Icon className="size-6 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <SectionIntro
          eyebrow="الستوري التشغيلي"
          title="كل حركة في الفرع لها أثر واضح"
          text="الصفحة ليست وعودا عامة. هذه هي الرحلات التي يديرها النظام من أول الطلب حتى قرار الإدارة."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {journeys.map((journey) => {
            const Icon = journey.icon;
            return (
              <div key={journey.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <Icon className="size-6 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{journey.title}</h3>
                <div className="mt-5 space-y-3">
                  {journey.steps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                        {index + 1}
                      </span>
                      <span className="text-sm text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="activities" className="bg-[#F7FAF7] py-20 dark:bg-[#0E1712]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionIntro
            eyebrow="إعدادات كل نشاط"
            title="النظام يبدأ من طبيعة البيزنس، وليس من قالب واحد للجميع"
            text="عند اختيار نوع النشاط، تتغير أوضاع البيع والتتبع والوحدات والسياسات الافتراضية حتى يبدأ الفريق من إعدادات قريبة من الواقع."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activityPresets.map((activity) => (
              <article key={activity.type} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold text-primary">{activity.category}</p>
                <h3 className="mt-2 text-2xl font-semibold">{activity.type}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{activity.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {activity.settings.map((setting) => (
                    <span
                      key={setting}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                    >
                      {setting}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="settings" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <SectionIntro
          eyebrow="إعدادات الإدارة"
          title="صاحب البيزنس يتحكم في طريقة العمل من مكان واحد"
          text="كل إعداد له معنى تشغيلي: من شكل الإيصال حتى من يحق له البيع بالجملة أو إعادة فتح إقفال شهري."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{section.title}</h3>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BadgeCheck className="size-4 shrink-0 text-chart-2" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-card py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-primary">ما الذي يقدمه للبيزنس؟</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
              تشغيل أقل عشوائية، وأرقام أكثر قابلية للتصرف.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              قيمة SweetFlow ليست في تسجيل الفاتورة فقط. القيمة في أن كل فاتورة تتحول إلى
              أثر على المخزون، والجلسة، والعميل، والتقرير، وبالتالي إلى قرار أفضل.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {proofPoints.map((point) => (
              <div key={point} className="rounded-lg border border-border bg-background p-5">
                <Workflow className="mb-4 size-5 text-chart-3" />
                <p className="text-sm leading-7">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="rounded-lg border border-border bg-foreground p-8 text-background shadow-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-background/70">الخطوة التالية</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                ابدأ من إعداد نشاطك، ثم دع التشغيل اليومي يبني التقارير تلقائيا.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-background/75">
                أنشئ الشركة والفرع الأول، اختر نوع النشاط والخصائص المناسبة، ثم افتح أول
                جلسة كاشير. من هنا يبدأ النظام في تكوين صورة تشغيلية كاملة.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/onboarding"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-background px-6 text-sm font-semibold text-foreground transition hover:bg-background/90"
              >
                إعداد الشركة
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-background/25 px-6 text-sm font-semibold text-background transition hover:bg-background/10"
              >
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
