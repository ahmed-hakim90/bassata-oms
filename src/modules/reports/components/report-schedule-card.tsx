"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateReportScheduleAction } from "@/modules/reports/actions/report-schedule.actions";
import {
  REPORT_SCHEDULE_KEYS,
  REPORT_SCHEDULE_LABELS_AR,
  type ReportScheduleKey,
  type ReportScheduleSettings,
} from "@/modules/reports/lib/report-schedule";

interface ReportScheduleCardProps {
  initial: ReportScheduleSettings;
  canManage: boolean;
}

export function ReportScheduleCard({ initial, canManage }: ReportScheduleCardProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);

  const toggleKey = (key: ReportScheduleKey, on: boolean) => {
    setForm((prev) => ({
      ...prev,
      reportKeys: on
        ? [...new Set([...prev.reportKeys, key])]
        : prev.reportKeys.filter((k) => k !== key),
    }));
  };

  const save = () => {
    startTransition(async () => {
      try {
        const next = await updateReportScheduleAction(form);
        setForm(next);
        toast.success("اتحفظ جدول التقارير");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل الحفظ");
      }
    });
  };

  return (
    <OperationalCard
      title="تصدير التقارير المجدوَل"
      description="إيميل للمالكين بملخص المبيعات وروابط التقارير (يتطلب Resend + CRON_SECRET)"
    >
      <div className="grid gap-4" dir="rtl">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={form.enabled}
            disabled={!canManage || pending}
            onCheckedChange={(v) => setForm({ ...form, enabled: v === true })}
          />
          <span className="text-sm">تفعيل الإرسال التلقائي</span>
        </label>

        <div className="space-y-2 max-w-xs">
          <Label>التكرار</Label>
          <Select
            value={form.cadence}
            disabled={!canManage || pending}
            onValueChange={(v) =>
              setForm({
                ...form,
                cadence: (v as ReportScheduleSettings["cadence"]) ?? "weekly",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  value === "daily" ? "يومي" : value === "monthly" ? "شهري" : "أسبوعي"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily" label="يومي">
                يومي
              </SelectItem>
              <SelectItem value="weekly" label="أسبوعي">
                أسبوعي
              </SelectItem>
              <SelectItem value="monthly" label="شهري">
                شهري
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>التقارير في الإيميل</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_SCHEDULE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.reportKeys.includes(key)}
                  disabled={!canManage || pending}
                  onCheckedChange={(v) => toggleKey(key, v === true)}
                />
                {REPORT_SCHEDULE_LABELS_AR[key]}
              </label>
            ))}
          </div>
        </div>

        {canManage ? (
          <Button onClick={save} disabled={pending} className="w-fit">
            حفظ الجدول
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">صلاحية الإعدادات مطلوبة للتعديل</p>
        )}
      </div>
    </OperationalCard>
  );
}
