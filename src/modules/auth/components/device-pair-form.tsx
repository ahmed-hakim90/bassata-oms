"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { pairDeviceWithCodeAction } from "@/modules/auth/actions/device.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DevicePairForm({ returnTo }: { returnTo?: string }) {
  const from = returnTo?.startsWith("/") ? returnTo : "/pos";
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await pairDeviceWithCodeAction(code);
      if (result.success) {
        toast.success("تم اقتران الجهاز");
        window.location.assign(from.startsWith("/") ? from : "/pos");
      } else {
        toast.error(result.error ?? "فشل الاقتران");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--mds-radius-xl)] border border-border bg-card shadow-[var(--mds-elevation-3)]">
      <div className="h-1.5 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="space-y-[var(--mds-space-5)] p-[var(--mds-space-8)]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-[var(--mds-space-4)] flex size-12 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-action-primary)] text-[var(--mds-color-text-inverse)]">
            <MonitorSmartphone className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">اقتران جهاز الكاشير</h1>
          <p className="mt-[var(--mds-space-2)] text-sm text-muted-foreground">
            أدخل كود الاستخدام الواحد من الإعدادات ← الأجهزة. تنتهي صلاحية الكود بعد 15 دقيقة.
          </p>
        </div>

        <div className="rounded-[var(--mds-radius-lg)] border border-[color-mix(in_srgb,var(--mds-color-feedback-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--mds-color-feedback-warning)_10%,transparent)] p-[var(--mds-space-4)] text-sm">
          <p className="font-medium text-foreground">لماذا تظهر هذه الرسالة؟</p>
          <p className="mt-1 text-muted-foreground">
            هذا المتصفح غير مسجل كجهاز كاشير للفرع الحالي. يتم حفظ الاقتران لكل متصفح ونطاق،
            لذلك قد يطلب النظام كودًا جديدًا عند تغيير الرابط أو حذف الكوكيز أو تعطيل الجهاز أو
            اختلاف الفرع.
          </p>
          <ul className="mt-3 list-disc space-y-1 pe-5 text-xs text-muted-foreground">
            <li>استخدم نفس الرابط يوميًا، ولا تبدّل بين localhost أو IP أو نطاق الإنتاج.</li>
            <li>تحديث الصفحة بقوة لا يزيل الاقتران إلا إذا تم حذف الكوكيز أو منعها.</li>
            <li>إذا تغير فرع هذا الكاشير، أعد الاقتران من الإعدادات ← الأجهزة لذلك الفرع.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pair-code">كود الاقتران</Label>
          <Input
            id="pair-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="كود من 8 أحرف"
            className="h-11 rounded-[var(--mds-radius-md)] font-mono uppercase tracking-widest"
            maxLength={12}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          className="h-10 w-full"
          disabled={pending || code.trim().length < 6}
          onClick={submit}
        >
          {pending ? "جاري الاقتران…" : "اقتران الجهاز"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          يجب{" "}
          <Link
            href={`/login?from=${encodeURIComponent("/device/pair")}`}
            className="text-[var(--mds-color-action-primary)] underline-offset-4 hover:underline"
          >
            تسجيل الدخول
          </Link>{" "}
          قبل اقتران هذا الجهاز.
        </p>
      </div>
    </div>
  );
}
