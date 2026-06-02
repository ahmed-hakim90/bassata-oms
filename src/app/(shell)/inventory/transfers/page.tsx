import { getTransfersData } from "@/modules/transfers/actions/transfer.actions";
import { TransfersPage } from "@/modules/transfers/components/transfers-page";

export default async function TransfersRoute() {
  const data = await getTransfersData();
  return <TransfersPage {...data} />;
}
