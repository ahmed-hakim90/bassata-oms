import { getMarginsReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { MarginsReportView } from "@/modules/reports/components/margins-report-view";

export default async function MarginsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getMarginsReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <MarginsReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
