import { getLoyaltyData } from "@/modules/loyalty/actions/loyalty.actions";
import { LoyaltyPage } from "@/modules/loyalty/components/loyalty-page";

export default async function LoyaltyRoute() {
  const data = await getLoyaltyData();
  return <LoyaltyPage {...data} />;
}
