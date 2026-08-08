import { getCashiersReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { CashiersReportView } from "@/modules/reports/components/cashiers-report-view";

export default async function CashiersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getCashiersReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <CashiersReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
