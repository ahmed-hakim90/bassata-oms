import { getProductStockCardPageData } from "@/modules/reports/actions/product-stock-card.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ProductStockCardView } from "@/modules/reports/components/product-stock-card-view";

export default async function ProductStockCardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getProductStockCardPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <ProductStockCardView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}
