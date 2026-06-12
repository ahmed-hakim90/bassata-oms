import Link from "next/link";
import {
  ArrowLeftRight,
  ClipboardList,
  Clock,
  Heart,
  MonitorSmartphone,
  Package,
  Rocket,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

const SETUP_STEPS = [
  {
    title: "أضف الفروع والمخازن",
    body: "من صفحة المخازن راجع مخزن كل فرع. كل فرع بيتعمل له مخزن رئيسي تلقائيًا، وتقدر تضيف مخازن إضافية (ثلاجة، مخزن إنتاج…).",
    href: "/inventory/warehouses",
    linkLabel: "إدارة المخازن",
    icon: Warehouse,
  },
  {
    title: "عرّف أجهزة الكاشير",
    body: "أضف جهاز لكل نقطة بيع واطبع كود الاقتران. على جهاز الكاشير افتح صفحة الاقتران وأدخل الكود مرة واحدة فقط.",
    href: "/devices",
    linkLabel: "إدارة الأجهزة",
    icon: MonitorSmartphone,
  },
  {
    title: "أضف المنتجات والتصنيفات",
    body: "أنشئ التصنيفات والمنتجات بالأسعار والباركود. تقدر تستورد ملف Excel من صفحة المنتجات.",
    href: "/products",
    linkLabel: "المنتجات",
    icon: Package,
  },
  {
    title: "فعّل برنامج الولاء",
    body: "حدد كام نقطة يكسبها العميل لكل جنيه، وقيمة النقطة عند الاستبدال. النقاط بتتحسب تلقائيًا مع كل فاتورة.",
    href: "/customers/loyalty",
    linkLabel: "إعدادات الولاء",
    icon: Heart,
  },
] as const;

const DAILY_STEPS = [
  {
    step: "١",
    title: "افتح وردية",
    body: "من صفحة الورديات افتح وردية جديدة وسجّل النقدية الافتتاحية في الدرج.",
  },
  {
    step: "٢",
    title: "بيع من شاشة الكاشير",
    body: "اختار المنتجات أو امسح الباركود، اربط العميل برقم موبايله علشان يكسب نقاط، واقبض نقدي أو كارت أو دفع مقسّم.",
  },
  {
    step: "٣",
    title: "استبدال نقاط الولاء",
    body: "لو العميل عنده نقاط، هتظهر في شاشة الدفع — اكتب عدد النقاط أو اضغط «استخدم الكل» وهتتخصم من الفاتورة فورًا.",
  },
  {
    step: "٤",
    title: "اقفل الوردية",
    body: "في نهاية اليوم عدّ النقدية الفعلية واقفل الوردية. النظام بيحسب الفرق تلقائيًا ويسجله في التقارير.",
  },
] as const;

const INVENTORY_TIPS = [
  {
    icon: Warehouse,
    title: "المخزن الافتراضي",
    body: "البيع من الكاشير بيخصم من المخزن الافتراضي للفرع تلقائيًا. غيّر المخزن الافتراضي من صفحة المخازن.",
  },
  {
    icon: ArrowLeftRight,
    title: "التحويلات",
    body: "انقل بضاعة بين الفروع والمخازن من صفحة التحويلات، مع تتبع حالة الإرسال والاستلام.",
  },
  {
    icon: ClipboardList,
    title: "الجرد",
    body: "اعمل جرد دوري من صفحة الجرد — النظام بيقارن العدد الفعلي بالمسجل ويظهر الفروقات.",
  },
] as const;

export default function GuidePage() {
  return (
    <>
      <PageHeader
        title="دليل الاستخدام"
        description="CafeFlow ERP & POS — كل اللي تحتاجه علشان تجهّز المتجر وتشغّل الكاشير يوم بيوم"
      />

      <OperationalCard
        title="الإعداد لأول مرة"
        description="أربع خطوات وتكون جاهز للبيع"
        className="mb-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {SETUP_STEPS.map(({ title, body, href, linkLabel, icon: Icon }, index) => (
            <div key={href} className="flex gap-3 rounded-2xl border border-border/60 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">
                  {index + 1}. {title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                <Link
                  href={href}
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {linkLabel} ←
                </Link>
              </div>
            </div>
          ))}
        </div>
      </OperationalCard>

      <OperationalCard
        title="يوم العمل على الكاشير"
        description="الدورة اليومية من فتح الوردية لإغلاقها"
        className="mb-6"
      >
        <ol className="grid gap-3 lg:grid-cols-4">
          {DAILY_STEPS.map(({ step, title, body }) => (
            <li key={step} className="rounded-2xl bg-muted/50 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                  {step}
                </span>
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Clock className="size-4" />
            الورديات
          </Link>
          <Link
            href="/pos/start"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ShoppingCart className="size-4" />
            شاشة الكاشير
          </Link>
        </div>
      </OperationalCard>

      <OperationalCard
        title="إدارة المخزون"
        description="إزاي البضاعة بتتحرك جوه النظام"
        className="mb-6"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {INVENTORY_TIPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Icon className="size-4 text-primary" />
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </OperationalCard>

      <OperationalCard
        title="برنامج ولاء العملاء"
        description="عميل بيرجع تاني أحسن من عميل جديد"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Rocket className="size-4 text-primary" />
              كسب النقاط
            </p>
            <p className="text-sm text-muted-foreground">
              اربط العميل بالفاتورة من شاشة الكاشير (بحث برقم الموبايل أو إنشاء عميل جديد
              بضغطة). النقاط بتتحسب تلقائيًا على إجمالي الفاتورة بعد الخصومات حسب المعدل اللي
              حددته في إعدادات الولاء.
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Heart className="size-4 text-primary" />
              استبدال النقاط
            </p>
            <p className="text-sm text-muted-foreground">
              في شاشة الدفع هيظهر رصيد نقاط العميل. الكاشير يكتب عدد النقاط أو يضغط «استخدم
              الكل» — القيمة بتتخصم من الفاتورة والنقاط بتتسجل في كشف حساب العميل فورًا.
            </p>
          </div>
        </div>
        <Link
          href="/customers/loyalty"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          إعدادات برنامج الولاء ←
        </Link>
      </OperationalCard>
    </>
  );
}
