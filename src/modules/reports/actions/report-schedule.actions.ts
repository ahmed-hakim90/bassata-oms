"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { upsertSetting, getSetting } from "@/modules/system/services/settings.service";
import {
  normalizeReportSchedule,
  reportScheduleSchema,
  type ReportScheduleSettings,
} from "@/modules/reports/lib/report-schedule";

export async function getReportScheduleAction(): Promise<ReportScheduleSettings> {
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const setting = await getSetting("report_schedule");
  return normalizeReportSchedule(setting?.value ?? null);
}

export async function updateReportScheduleAction(
  input: Partial<ReportScheduleSettings>
): Promise<ReportScheduleSettings> {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const current = await getReportScheduleAction();
  const next = reportScheduleSchema.parse({ ...current, ...input });
  await upsertSetting("report_schedule", next, user.id);
  revalidatePath("/reports");
  revalidatePath("/settings");
  revalidatePath("/settings", "layout");
  return next;
}
