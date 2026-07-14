import { getProductStockCardPageData } from "@/modules/reports/actions/product-stock-card.actions";
import { ProductCardPrintView } from "@/modules/reports/components/product-card-print-view";

export default async function PrintProductStockCardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getProductStockCardPageData(params);
  return <ProductCardPrintView {...data} />;
}
