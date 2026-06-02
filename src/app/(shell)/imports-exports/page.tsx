import { ImportsExportsPage } from "@/modules/imports-exports/components/imports-exports-page";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";

export default async function Page() {
  const [products, customers] = await Promise.all([
    catalogRepo.listProducts(),
    customerRepo.listCustomers(),
  ]);
  return <ImportsExportsPage products={products} customers={customers} />;
}
