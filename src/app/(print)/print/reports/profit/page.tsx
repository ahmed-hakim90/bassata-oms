import { getProfitReportPageData } from "@/modules/reports/actions/profit-report.actions";
import { ProfitReportPrintView } from "@/modules/reports/components/profit-report-print-view";

export default async function PrintProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getProfitReportPageData(params);
  return <ProfitReportPrintView {...data} />;
}
