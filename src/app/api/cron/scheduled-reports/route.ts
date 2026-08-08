import { NextResponse } from "next/server";
import { runScheduledReportDigests } from "@/modules/reports/services/scheduled-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/** Vercel Cron / manual: Authorization: Bearer $CRON_SECRET */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledReportDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/scheduled-reports]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
