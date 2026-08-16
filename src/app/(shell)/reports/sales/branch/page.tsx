import { getBranchSalesMiniPageData } from "@/modules/reports/actions/sales-entity-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { BranchSalesMiniView } from "@/modules/reports/components/branch-sales-mini-view";

export default async function BranchSalesMiniPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getBranchSalesMiniPageData(params),
    getReportCapabilities(),
  ]);
  return <BranchSalesMiniView {...data} canExcel={caps.canExcel} />;
}
