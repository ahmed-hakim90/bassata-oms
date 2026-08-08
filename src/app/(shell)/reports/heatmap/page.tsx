import { getHeatmapReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { HeatmapReportView } from "@/modules/reports/components/heatmap-report-view";

export default async function HeatmapReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getHeatmapReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <HeatmapReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
