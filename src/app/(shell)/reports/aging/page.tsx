import { getAgingReportPageData } from "@/modules/reports/actions/aging-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { AgingReportView } from "@/modules/reports/components/aging-report-view";

export default async function AgingReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getAgingReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <AgingReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
