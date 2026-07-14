import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { PriceListPrintView } from "@/modules/price-lists/components/price-list-print-view";

export default async function PrintPriceListPage() {
  const auth = await requirePageAuth("/print/price-list");
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  return <PriceListPrintView />;
}
