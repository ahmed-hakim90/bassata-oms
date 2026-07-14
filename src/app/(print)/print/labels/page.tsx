import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { runPageAuth } from "@/lib/auth/page-guard";
import { requireBarcodeLabelAccess } from "@/modules/reports/actions/report-access.actions";
import { LabelPrintView } from "@/modules/reports/labels/label-print-view";

export default async function PrintLabelsPage() {
  const auth = await runPageAuth(async () => {
    await requireBarcodeLabelAccess();
    return true as const;
  }, "/print/labels");

  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  return <LabelPrintView />;
}
