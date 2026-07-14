import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getStockCount } from "@/modules/stock-count/services/count.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import * as catalogRepo from "@/lib/repositories/catalog.repository";

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
    <PrintableDocument
      branding={branding}
      title="تقرير جرد المخزون"
      subtitle={`جرد ${count.id.slice(0, 8)}`}
      dateRange={count.started_at}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">المنتج</th>
            <th className="py-2 text-end">النظام</th>
            <th className="py-2 text-end">المعدود</th>
            <th className="py-2 text-end">الفرق</th>
          </tr>
        </thead>
        <tbody>
          {count.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{productMap.get(line.product_id) ?? line.product_id}</td>
              <td className="py-2 text-end">{line.expected_qty}</td>
              <td className="py-2 text-end">{line.counted_qty}</td>
              <td className="py-2 text-end">{line.variance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
