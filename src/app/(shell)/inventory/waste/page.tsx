import { getWasteData } from "@/modules/waste/actions/waste.actions";
import { WastePage } from "@/modules/waste/components/waste-page";

export default async function WasteRoute() {
  const data = await getWasteData();
  return <WastePage {...data} />;
}
