import { getTaxReportPageData } from "@/modules/reports/actions/tax-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { TaxReportView } from "@/modules/reports/components/tax-report-view";

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getTaxReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <TaxReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
