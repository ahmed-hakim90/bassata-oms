import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getStockCount } from "@/modules/stock-count/services/count.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { StockCountPrintView } from "@/modules/stock-count/components/stock-count-print-view";

export default async function PrintStockCountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requirePageAuth("/print/stock-count");
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }
  const user = auth.data;
  const { id } = await params;
  const count = await getStockCount(id);
  if (!count) notFound();
  const [branding, products] = await Promise.all([
    getReportBranding(count.store_id),
    catalogRepo.listProducts(),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return (
    <StockCountPrintView
      count={count}
      productMap={productMap}
      branding={branding}
      userName={user.name}
    />
  );
}
