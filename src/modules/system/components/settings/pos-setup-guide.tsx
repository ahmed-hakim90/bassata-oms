"use client";

import Link from "next/link";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

const steps = [
  { text: "أضف فرعًا أو اختر فرعًا موجودًا بالأسفل واحفظ بياناته." },
  { text: "تأكد من وجود مخزن افتراضي نشط للفرع." },
  { text: "أضف جهاز كاشير داخل بطاقة نفس الفرع." },
  {
    text: "اربط الجهاز من /device/pair بكود استخدام واحد، أو اضغط تسجيل هذا المتصفح من صف الجهاز.",
    href: "/device/pair",
  },
  {
    text: "أنشئ حسابات الكاشير من الإعدادات ← المستخدمون والأدوار مع صلاحية الفرع وكلمة مرور 8 أحرف أو أكثر وقيود أجهزة اختيارية.",
    href: "/settings?tab=users",
  },
  { text: "يسجل الكاشير الدخول من /login بالبريد الإلكتروني وكلمة المرور." },
  { text: "يختار الكاشير الفرع إذا كان لديه أكثر من فرع.", href: "/pos/start" },
  { text: "يفتح الكاشير جلسة من صفحة الجلسات.", href: "/sessions" },
  { text: "ابدأ البيع من شاشة الكاشير.", href: "/pos" },
];

export function PosSetupGuide() {
  return (
    <OperationalCard title="قائمة تجهيز الكاشير للتشغيل">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i}>
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
    </OperationalCard>
  );
}
