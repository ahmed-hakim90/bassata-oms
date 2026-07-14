import { PrintableDocument } from "@/modules/reports/components/printable-document";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface StockCountPrintData {
  count: {
    id: string;
    started_at: string;
    lines: Array<{
      id: string;
      product_id: string;
      expected_qty: number;
      counted_qty: number;
      variance: number;
    }>;
  };
  productMap: Map<string, string>;
  branding: ReportBranding;
  userName: string;
}

export function StockCountPrintView({
  count,
  productMap,
  branding,
  userName,
}: StockCountPrintData) {
  return (
    <PrintableDocument
      branding={branding}
      title="تقرير جرد المخزون"
      subtitle={`جرد ${count.id.slice(0, 8)}`}
      dateRange={count.started_at}
      generatedBy={userName}
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
