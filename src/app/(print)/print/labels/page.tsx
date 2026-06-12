import { getLabelPageData } from "@/modules/reports/actions/label.actions";
import { LabelDocument } from "@/modules/reports/labels/label-document";

export default async function PrintLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; copies?: string }>;
}) {
  const params = await searchParams;
  const data = await getLabelPageData();
  const ids = (params.ids ?? "").split(",").filter(Boolean);
  const copies = Number(params.copies ?? data.settings.defaultCopies) || 1;
  const items = data.products
    .filter((p) => ids.includes(p.id))
    .map((p) => ({
      id: p.id,
      productName: p.name,
      barcode: p.barcode || p.sku,
      sku: p.sku,
      price: p.sale_price ?? p.base_price,
      copies,
    }));

  return <LabelDocument items={items} settings={data.settings} currency={data.currency} />;
}
