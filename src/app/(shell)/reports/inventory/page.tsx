import { getInventoryReportPageData } from "@/modules/reports/actions/inventory-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { InventoryReportView } from "@/modules/reports/components/inventory-report-view";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getInventoryReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <InventoryReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
