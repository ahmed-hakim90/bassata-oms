import { getReplenishmentReportPageData } from "@/modules/reports/actions/replenishment-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ReplenishmentReportView } from "@/modules/reports/components/replenishment-report-view";

export default async function ReplenishmentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getReplenishmentReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <ReplenishmentReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
