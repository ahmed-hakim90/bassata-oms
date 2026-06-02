import { getSuppliersPageDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { SuppliersPage } from "@/modules/suppliers/components/suppliers-page";

export default async function SuppliersRoute() {
  const data = await getSuppliersPageDataAction();
  return <SuppliersPage summaries={data.summaries} currency={data.currency} />;
}
