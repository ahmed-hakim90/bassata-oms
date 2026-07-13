import { getProductStockCardPageData } from "@/modules/reports/actions/product-stock-card.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatDateTime } from "@/lib/format";

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-EG", {
    maximumFractionDigits: 4,
    numberingSystem: "latn",
  });
}

export default async function PrintProductStockCardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getProductStockCardPageData(params);
  const r = data.report;

  if (!r) {
    return (
      <PrintableDocument
        branding={data.context}
        title="كارت صنف"
        generatedBy={data.context.generatedBy}
        generatedAt={data.context.generatedAt}
      >
        <p className="text-sm text-muted-foreground">اختار صنف لطباعة الكارت.</p>
      </PrintableDocument>
    );
  }

  const fromLabel = new Date(r.fromIso).toLocaleDateString("ar-EG");
  const toLabel = new Date(r.toIso).toLocaleDateString("ar-EG");
  const unit = r.product.unitLabel;

  return (
    <PrintableDocument
      branding={data.context}
      title="كارت صنف"
      dateRange={`${fromLabel} — ${toLabel}`}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={`${r.product.name}${r.product.sku ? ` · ${r.product.sku}` : ""}${
        r.warehouseName ? ` · ${r.warehouseName}` : " · كل المخازن"
      }`}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium">بدانا بـ</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.openingQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">جه</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.totals.inQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">طلع</td>
            <td className="py-2 text-end tabular-nums">
              {formatQty(r.totals.outQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">اتساوى</td>
            <td className="py-2 text-end tabular-nums">
              {r.totals.equalizeQty > 0 ? "+" : ""}
              {formatQty(r.totals.equalizeQty)} {unit}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">متاح (نهاية الفترة)</td>
            <td className="py-2 text-end font-semibold tabular-nums">
              {formatQty(r.closingQty)} {unit}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">التاريخ</th>
            <th className="py-2 text-start">النوع</th>
            <th className="py-2 text-end">جه</th>
            <th className="py-2 text-end">طلع</th>
            <th className="py-2 text-end">اتساوى</th>
            <th className="py-2 text-end">الرصيد</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-muted/20">
            <td className="py-2" colSpan={5}>
              رصيد افتتاحي
            </td>
            <td className="py-2 text-end font-medium tabular-nums">
              {formatQty(r.openingQty)}
            </td>
          </tr>
          {r.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2 whitespace-nowrap">{formatDateTime(line.at)}</td>
              <td className="py-2">{line.movementTypeLabel}</td>
              <td className="py-2 text-end tabular-nums">
                {line.inQty > 0 ? formatQty(line.inQty) : "—"}
              </td>
              <td className="py-2 text-end tabular-nums">
                {line.outQty > 0 ? formatQty(line.outQty) : "—"}
              </td>
              <td className="py-2 text-end tabular-nums">
                {line.equalizeQty !== 0
                  ? `${line.equalizeQty > 0 ? "+" : ""}${formatQty(line.equalizeQty)}`
                  : "—"}
              </td>
              <td className="py-2 text-end font-medium tabular-nums">
                {formatQty(line.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
