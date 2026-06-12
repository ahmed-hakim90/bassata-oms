import { getSalesReportPageData } from "@/modules/reports/actions/sales-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { SalesReportView } from "@/modules/reports/components/sales-report-view";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getSalesReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <SalesReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
