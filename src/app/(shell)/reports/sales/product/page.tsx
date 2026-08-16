import { getProductSalesMiniPageData } from "@/modules/reports/actions/sales-entity-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ProductSalesMiniView } from "@/modules/reports/components/product-sales-mini-view";

export default async function ProductSalesMiniPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getProductSalesMiniPageData(params),
    getReportCapabilities(),
  ]);
  return <ProductSalesMiniView {...data} canExcel={caps.canExcel} />;
}
