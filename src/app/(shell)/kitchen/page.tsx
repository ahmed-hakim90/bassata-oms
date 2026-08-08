import { KitchenDisplay } from "@/modules/kitchen/components/kitchen-display";
import { listKitchenTickets } from "@/modules/kitchen/services/kitchen.service";

export default async function KitchenPage() {
  const tickets = await listKitchenTickets();
  return <KitchenDisplay initialTickets={tickets} />;
}
