import { getCustomersData } from "@/modules/customers/actions/customer.actions";
import { CustomersPage } from "@/modules/customers/components/customers-page";
import { getFeatureFlags } from "@/modules/system/services/settings.service";

export default async function CustomersRoute() {
  const [data, flags] = await Promise.all([getCustomersData(), getFeatureFlags()]);
  return (
    <CustomersPage
      customers={data.customers}
      creditSalesEnabled={flags.credit_sales === true}
    />
  );
}
