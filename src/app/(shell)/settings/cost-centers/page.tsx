import { redirect } from "next/navigation";

export default function CostCentersRoute() {
  redirect("/settings?tab=expenses");
}
