import { getProfitReportPageData } from "@/modules/reports/actions/profit-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ProfitReportView } from "@/modules/reports/components/profit-report-view";

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getProfitReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <ProfitReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
