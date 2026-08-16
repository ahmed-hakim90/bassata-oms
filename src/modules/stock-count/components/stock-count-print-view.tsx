import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatUnit } from "@/lib/units";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import type { CountSheetGroup, CountSheetLine } from "@/modules/stock-count/lib/count-sheet";
import { countSheetTotals } from "@/modules/stock-count/lib/count-sheet";

export interface StockCountPrintViewProps {
  title: string;
  subtitle?: string;
  filterSummary: string;
  groups: CountSheetGroup[];
  lines: CountSheetLine[];
  truncated: boolean;
  blankCounted: boolean;
  branding: ReportBranding;
  userName: string;
}

function qtyCell(value: number | null): string {
  if (value == null) return "";
  return String(value);
}

export function StockCountPrintView({
  title,
  subtitle,
  filterSummary,
  groups,
  lines,
  truncated,
  blankCounted,
  branding,
  userName,
}: StockCountPrintViewProps) {
  const totals = countSheetTotals(lines);

  return (
    <PrintableDocument
      branding={branding}
      title={title}
      subtitle={subtitle}
      filterSummary={filterSummary}
      generatedBy={userName}
      generatedAt={new Date().toISOString()}
    >
      <p className="mb-4 text-sm">
        أصناف: {totals.products} · رصيد النظام: {totals.systemUnits}
        {totals.countedUnits != null ? ` · المعدود: ${totals.countedUnits}` : ""}
        {totals.varianceUnits != null
          ? ` · الفرق: ${totals.varianceUnits > 0 ? "+" : ""}${totals.varianceUnits}`
          : ""}
      </p>
      {truncated ? (
        <p className="mb-3 text-xs text-muted-foreground">
          تم قص القائمة عند 500 صنف. ضيّق الفلتر (قسم أو منتج) عشان تطبع الباقي.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.categoryId} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">{group.categoryName}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-start">المنتج</th>
                <th className="py-2 text-start">باركود</th>
                <th className="py-2 text-end">النظام</th>
                <th className="py-2 text-end">المعدود</th>
                {blankCounted ? null : (
                  <th className="py-2 text-end">الفرق</th>
                )}
              </tr>
            </thead>
            <tbody>
              {group.lines.map((line) => (
                <tr key={line.productId} className="border-b">
                  <td className="py-2">
                    {line.name}
                    {line.unit ? (
                      <span className="ms-1 text-xs text-muted-foreground">
                        ({formatUnit(line.unit)})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {line.barcode || line.sku || "—"}
                  </td>
                  <td className="py-2 text-end tabular-nums">{line.expectedQty}</td>
                  <td className="py-2 text-end tabular-nums">
                    {qtyCell(line.countedQty)}
                  </td>
                  {blankCounted ? null : (
                    <td className="py-2 text-end tabular-nums">
                      {line.variance == null
                        ? ""
                        : `${line.variance > 0 ? "+" : ""}${line.variance}`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {lines.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          مفيش أصناف بتتبع مخزون بالمعايير دي.
        </p>
      ) : null}
    </PrintableDocument>
  );
}
