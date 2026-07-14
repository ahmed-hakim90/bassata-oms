import { getSalesReportPageData } from "@/modules/reports/actions/sales-report.actions";
import { SalesReportPrintView } from "@/modules/reports/components/sales-report-print-view";

export default async function PrintSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getSalesReportPageData(params);
  return <SalesReportPrintView {...data} />;
}
