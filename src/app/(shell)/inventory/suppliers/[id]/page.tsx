import { notFound } from "next/navigation";
import { getSupplierDetailDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { SupplierDetailPage } from "@/modules/suppliers/components/supplier-detail-page";

export default async function SupplierDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const data = await getSupplierDetailDataAction(id);
  if (!data) notFound();

  return (
    <SupplierDetailPage
      initialStatement={data.statement}
      currency={data.currency}
      canManagePayments={data.canManagePayments}
      canEditSupplier={data.canEditSupplier}
      storeId={data.storeId}
      initialPayOpen={query.pay === "1" && data.canManagePayments}
    />
  );
}
