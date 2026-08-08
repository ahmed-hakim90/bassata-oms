import { getPeriodsReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { PeriodsReportView } from "@/modules/reports/components/periods-report-view";

export default async function PeriodsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getPeriodsReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <PeriodsReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
