"use client";

import Link from "next/link";
import type { BusinessActivityType } from "@/lib/constants";
import { BUSINESS_ACTIVITY_TYPE_LABELS } from "@/lib/constants";

const BASE_STEPS: { text: string; href?: string }[] = [
  { text: "أضف فرعًا واحفظ بياناته" },
  { text: "تأكد من مخزن افتراضي نشط" },
  { text: "أنشئ حسابات الكاشير", href: "/settings?tab=users" },
  { text: "اضبط slug الفرع من تبويب المنيو (رابط الكاشير يظهر تلقائيًا)", href: "/settings?tab=branches" },
  { text: "افتح /اسم-الفرع/pos واكتب PIN الكاشير", href: "/pos" },
  { text: "افتح جلسة ثم ابدأ البيع", href: "/pos" },
];

const ACTIVITY_EXTRA_STEPS: Partial<
  Record<BusinessActivityType, { text: string; href?: string }[]>
> = {
  supermarket: [
    { text: "فعّل البيع بالوزن/المبلغ من تبويب النشاط" },
  ],
  restaurant: [
    { text: "أضف إضافات (Modifiers) على منتجات المنيو", href: "/products" },
    { text: "افتح شاشة المطبخ لمتابعة الطلبات", href: "/kitchen" },
  ],
  cafe: [
    { text: "أضف أحجام/خيارات للمنتجات (variants)", href: "/products" },
    { text: "افتح شاشة المطبخ لمتابعة الطلبات", href: "/kitchen" },
  ],
  juice_bar: [
    { text: "فعّل الوصفات للمكونات القابلة للخصم", href: "/settings?tab=features" },
    { text: "افتح شاشة المطبخ لمتابعة الطلبات", href: "/kitchen" },
  ],
  ice_cream: [
    { text: "فعّل الوصفات وتتبع الصلاحية (FEFO)", href: "/settings?tab=activity" },
    { text: "افتح شاشة المطبخ لمتابعة الطلبات", href: "/kitchen" },
  ],
  wholesale: [
    { text: "اضبط شرائح أسعار الجملة على المنتجات", href: "/products" },
    { text: "فعّل البيع الآجل وحدود ائتمان العملاء", href: "/customers" },
  ],
  mixed: [
    { text: "راجع صلاحية الجملة للكاشير (تحتاج مدير عادةً)" },
    { text: "فعّل البيع الآجل وحدود الائتمان", href: "/customers" },
  ],
  bakery: [
    { text: "فعّل الوصفات للإنتاج وتتبع الصلاحية", href: "/settings?tab=activity" },
    { text: "فعّل الوزن إن كنت تبيع بالكيلو", href: "/settings?tab=activity" },
    { text: "افتح شاشة المطبخ لمتابعة الطلبات", href: "/kitchen" },
  ],
  pharmacy: [
    { text: "طبّق إعدادات الصيدلية (دفعات + FEFO + منع بيع منتهي)", href: "/settings?tab=activity" },
    { text: "أدخل تشغيلات بصلاحية عند الشراء/الجرد" },
    { text: "عند البيع: النظام يمنع التشغيلة المنتهية برسالة واضحة للكاشير" },
  ],
  retail: [
    { text: "فعّل العروض/الولاء اختياريًا من الخصائص", href: "/settings?tab=features" },
  ],
};

export function PosSetupGuide({
  activityType,
}: {
  activityType?: BusinessActivityType;
}) {
  const extras = activityType ? ACTIVITY_EXTRA_STEPS[activityType] ?? [] : [];
  const steps = [...BASE_STEPS, ...extras];

  return (
    <details className="rounded-[var(--mds-radius-lg)] border border-border bg-card px-3 py-2 shadow-[var(--mds-elevation-1)]">
      <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
        دليل تجهيز الكاشير
        {activityType ? (
          <span className="ms-1 font-normal text-muted-foreground">
            ({BUSINESS_ACTIVITY_TYPE_LABELS[activityType]})
          </span>
        ) : null}
      </summary>
      <ol className="mt-2 list-decimal space-y-1.5 ps-5 pb-1 text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step.text}>
            {step.href ? (
              <Link
                href={step.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {step.text}
              </Link>
            ) : (
              step.text
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
