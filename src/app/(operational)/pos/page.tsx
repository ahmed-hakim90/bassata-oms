import { PosScreen } from "@/modules/pos/components/pos-screen";
import { getPosPageData } from "@/modules/pos/services/pos-page-data.service";

export default async function PosPage() {
  const data = await getPosPageData();
  return <PosScreen {...data} />;
}
