import { getCustomersData } from "@/modules/customers/actions/customer.actions";
import { CustomersPage } from "@/modules/customers/components/customers-page";

export default async function CustomersRoute() {
  const data = await getCustomersData();
  return <CustomersPage customers={data.customers} />;
}
