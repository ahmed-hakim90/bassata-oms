import { getDailyCloseReportPageData } from "@/modules/reports/actions/daily-close-report.actions";
import { DailyClosePrintView } from "@/modules/reports/components/daily-close-print-view";

export default async function PrintDailyCloseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDailyCloseReportPageData(params);
  return <DailyClosePrintView {...data} />;
}
