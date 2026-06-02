import { getReportsData } from "@/modules/reports/actions/reports.actions";
import { ReportsDashboard } from "@/modules/reports/components/reports-dashboard";

export default async function ReportsRoute({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; storeId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const days = Number(params.days ?? 30);
  const safeDays = Number.isFinite(days) ? days : 30;
  const range =
    params.from ? { from: params.from, to: params.to } : undefined;
  const data = await getReportsData(safeDays, params.storeId ?? null, range);
  return (
    <ReportsDashboard
      {...data}
      days={safeDays}
      filterStoreId={params.storeId ?? "all"}
      customFrom={params.from ?? ""}
      customTo={params.to ?? ""}
    />
  );
}
