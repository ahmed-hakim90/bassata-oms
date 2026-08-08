import { z } from "zod";

export const REPORT_SCHEDULE_KEYS = [
  "sales",
  "profit",
  "daily-close",
  "pnl",
  "branches",
] as const;

export type ReportScheduleKey = (typeof REPORT_SCHEDULE_KEYS)[number];

export const reportScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  cadence: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  /** 0=Sunday … 6=Saturday — used when cadence=weekly */
  dayOfWeek: z.number().int().min(0).max(6).default(1),
  /** 1–28 — used when cadence=monthly */
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  reportKeys: z.array(z.enum(REPORT_SCHEDULE_KEYS)).default(["sales", "pnl"]),
});

export type ReportScheduleSettings = z.infer<typeof reportScheduleSchema>;

export const DEFAULT_REPORT_SCHEDULE: ReportScheduleSettings = {
  enabled: false,
  cadence: "weekly",
  dayOfWeek: 1,
  dayOfMonth: 1,
  reportKeys: ["sales", "pnl"],
};

export function normalizeReportSchedule(
  value: Record<string, unknown> | null | undefined
): ReportScheduleSettings {
  const parsed = reportScheduleSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_REPORT_SCHEDULE };
}

/** Whether the schedule should fire for this UTC calendar day. */
export function isReportScheduleDue(
  schedule: ReportScheduleSettings,
  now = new Date()
): boolean {
  if (!schedule.enabled) return false;
  if (schedule.cadence === "daily") return true;
  if (schedule.cadence === "weekly") return now.getUTCDay() === schedule.dayOfWeek;
  return now.getUTCDate() === schedule.dayOfMonth;
}

export const REPORT_SCHEDULE_LABELS_AR: Record<ReportScheduleKey, string> = {
  sales: "تقرير المبيعات",
  profit: "تقرير الأرباح",
  "daily-close": "الإقفال اليومي",
  pnl: "قائمة الأرباح والخسائر",
  branches: "مقارنة الفروع",
};
