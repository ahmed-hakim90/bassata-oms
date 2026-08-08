import { getPnlReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { PnlReportView } from "@/modules/reports/components/pnl-report-view";

export default async function PnlReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getPnlReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <PnlReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
