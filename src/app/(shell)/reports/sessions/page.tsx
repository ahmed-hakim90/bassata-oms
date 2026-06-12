import { getSessionsReportPageData } from "@/modules/reports/actions/session-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { SessionsReportView } from "@/modules/reports/components/sessions-report-view";

export default async function SessionsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getSessionsReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <SessionsReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
