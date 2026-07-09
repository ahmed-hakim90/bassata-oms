"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">اقتران جهاز الكاشير</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          أدخل كود الاستخدام الواحد من الإعدادات ← الأجهزة. تنتهي صلاحية الكود بعد 15 دقيقة.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-medium">لماذا تظهر هذه الرسالة؟</p>
        <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
          هذا المتصفح غير مسجل كجهاز كاشير للفرع الحالي. يتم حفظ الاقتران لكل متصفح ونطاق،
          لذلك قد يطلب النظام كودًا جديدًا عند تغيير الرابط أو حذف الكوكيز أو تعطيل الجهاز أو
          اختلاف الفرع.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800/90 dark:text-amber-200/90">
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
          className="font-mono uppercase tracking-widest"
          maxLength={12}
          autoComplete="off"
        />
      </div>
      <Button className="w-full" disabled={pending || code.trim().length < 6} onClick={submit}>
        {pending ? "جاري الاقتران…" : "اقتران الجهاز"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        يجب{" "}
        <Link
          href={`/login?from=${encodeURIComponent("/device/pair")}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          تسجيل الدخول
        </Link>{" "}
        قبل اقتران هذا الجهاز.
      </p>
    </div>
  );
}
