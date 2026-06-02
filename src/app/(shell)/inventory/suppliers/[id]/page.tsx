import { notFound } from "next/navigation";
import { getSupplierDetailDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { SupplierDetailPage } from "@/modules/suppliers/components/supplier-detail-page";

export default async function SupplierDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSupplierDetailDataAction(id);
  if (!data) notFound();

  return (
    <SupplierDetailPage
      initialStatement={data.statement}
      currency={data.currency}
      canManagePayments={data.canManagePayments}
      canEditSupplier={data.canEditSupplier}
    />
  );
}
