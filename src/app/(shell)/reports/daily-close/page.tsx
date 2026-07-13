import { getDailyCloseReportPageData } from "@/modules/reports/actions/daily-close-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { DailyCloseReportView } from "@/modules/reports/components/daily-close-report-view";

export default async function DailyCloseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getDailyCloseReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <DailyCloseReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
