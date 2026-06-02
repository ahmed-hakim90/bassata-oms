import { getStockCountData } from "@/modules/stock-count/actions/count.actions";
import { StockCountPage } from "@/modules/stock-count/components/stock-count-page";

export default async function StockCountRoute() {
  const data = await getStockCountData();
  return <StockCountPage {...data} />;
}
