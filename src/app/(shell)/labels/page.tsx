import { getLabelPageData } from "@/modules/reports/actions/label.actions";
import { LabelsPage } from "@/modules/reports/components/labels-page";

export default async function LabelsRoute() {
  const data = await getLabelPageData();
  return (
    <LabelsPage
      products={data.products}
      currency={data.currency}
      initialSettings={data.settings}
    />
  );
}
