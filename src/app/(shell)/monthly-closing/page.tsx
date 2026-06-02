import { getClosingData } from "@/modules/monthly-closing/actions/closing.actions";
import { ClosingPage } from "@/modules/monthly-closing/components/closing-page";

export default async function MonthlyClosingRoute() {
  const data = await getClosingData();
  return <ClosingPage {...data} />;
}
