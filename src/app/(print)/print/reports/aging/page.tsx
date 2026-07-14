import { getAgingReportPageData } from "@/modules/reports/actions/aging-report.actions";
import { AgingReportPrintView } from "@/modules/reports/components/aging-report-print-view";

export default async function PrintAgingReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getAgingReportPageData(params);
  return <AgingReportPrintView {...data} />;
}
