import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/format";
import { listOwnerEmails } from "@/lib/email/recipients";
import { sendEmail } from "@/lib/services/email.service";
import { ScheduledReportDigestEmail } from "@/lib/email/templates/scheduled-report-digest";
import {
  isReportScheduleDue,
  normalizeReportSchedule,
  REPORT_SCHEDULE_LABELS_AR,
  type ReportScheduleKey,
  type ReportScheduleSettings,
} from "@/modules/reports/lib/report-schedule";

const REPORT_PATH: Record<ReportScheduleKey, string> = {
  sales: "/reports/sales",
  profit: "/reports/profit",
  "daily-close": "/reports/daily-close",
  pnl: "/reports/pnl",
  branches: "/reports/branches",
};

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function periodDays(cadence: ReportScheduleSettings["cadence"]): number {
  if (cadence === "daily") return 1;
  if (cadence === "weekly") return 7;
  return 30;
}

async function loadOrgSchedule(
  orgId: string
): Promise<ReportScheduleSettings | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "report_schedule")
    .maybeSingle();
  if (error) {
    console.error("[scheduled-reports] load schedule failed", orgId, error.message);
    return null;
  }
  return normalizeReportSchedule((data?.value as Record<string, unknown>) ?? null);
}

async function orgSalesSummary(
  orgId: string,
  fromIso: string
): Promise<{ revenue: number; orderCount: number; currency: string; name: string }> {
  const admin = createAdminClient();
  const [{ data: org }, { data: stores }] = await Promise.all([
    admin.from("organizations").select("name, currency").eq("id", orgId).maybeSingle(),
    admin.from("stores").select("id").eq("org_id", orgId),
  ]);
  const storeIds = (stores ?? []).map((s) => s.id);
  if (storeIds.length === 0) {
    return {
      revenue: 0,
      orderCount: 0,
      currency: org?.currency ?? "EGP",
      name: org?.name ?? "المنشأة",
    };
  }

  const { data: orders, error } = await admin
    .from("orders")
    .select("total, status")
    .in("store_id", storeIds)
    .eq("status", "completed")
    .gte("created_at", fromIso);

  if (error) {
    console.error("[scheduled-reports] orders query failed", orgId, error.message);
    return {
      revenue: 0,
      orderCount: 0,
      currency: org?.currency ?? "EGP",
      name: org?.name ?? "المنشأة",
    };
  }

  const rows = orders ?? [];
  return {
    revenue: rows.reduce((s, o) => s + Number(o.total ?? 0), 0),
    orderCount: rows.length,
    currency: org?.currency ?? "EGP",
    name: org?.name ?? "المنشأة",
  };
}

export async function runScheduledReportDigests(now = new Date()): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
}> {
  const admin = createAdminClient();
  const { data: orgs, error } = await admin.from("organizations").select("id");
  if (error) {
    console.error("[scheduled-reports] list orgs failed", error.message);
    throw new Error("فشل تحميل المنشآت");
  }

  let sent = 0;
  let skipped = 0;
  const origin = appOrigin();

  for (const org of orgs ?? []) {
    const schedule = await loadOrgSchedule(org.id);
    if (!schedule || !isReportScheduleDue(schedule, now)) {
      skipped += 1;
      continue;
    }

    const days = periodDays(schedule.cadence);
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - days);
    const summary = await orgSalesSummary(org.id, from.toISOString());
    const owners = await listOwnerEmails(org.id);
    if (owners.length === 0) {
      skipped += 1;
      continue;
    }

    const periodLabel =
      schedule.cadence === "daily"
        ? "آخر يوم"
        : schedule.cadence === "weekly"
          ? "آخر أسبوع"
          : "آخر شهر";

    const reportLinks = schedule.reportKeys.map((key) => ({
      label: REPORT_SCHEDULE_LABELS_AR[key],
      href: `${origin}${REPORT_PATH[key]}?days=${days}`,
    }));

    const result = await sendEmail({
      to: owners,
      subject: `ملخص تقارير ${summary.name} — ${periodLabel}`,
      react: (
        <ScheduledReportDigestEmail
          orgName={summary.name}
          periodLabel={periodLabel}
          revenueLabel={formatCurrency(summary.revenue, summary.currency)}
          orderCount={summary.orderCount}
          reportLinks={reportLinks}
        />
      ),
      tags: [
        { name: "category", value: "scheduled_report" },
        { name: "org_id", value: org.id.slice(0, 36) },
      ],
    });

    if (result.ok) sent += 1;
    else skipped += 1;
  }

  return { scanned: orgs?.length ?? 0, sent, skipped };
}
