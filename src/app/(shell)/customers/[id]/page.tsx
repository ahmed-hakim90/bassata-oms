import { notFound } from "next/navigation";
import { getCustomerProfileData } from "@/modules/customers/actions/customer.actions";
import { CustomerDetailPage } from "@/modules/customers/components/customer-detail-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";

export default async function CustomerDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCustomerProfileData(id);
  if (!data) notFound();
  const user = await getCurrentUser();
  const permissions = user ? await getEffectivePermissions(user) : new Set();
  const canCollect =
    user?.role === "owner" ||
    user?.role === "manager" ||
    user?.role === "cashier" ||
    permissions.has("customer_payment_receive");
  const canEdit =
    user?.role === "owner" ||
    user?.role === "manager" ||
    permissions.has("customer_manage");

  return (
    <CustomerDetailPage
      profile={data.profile}
      ledger={data.ledger}
      statement={data.statement}
      canCollect={canCollect}
      canEdit={canEdit}
    />
  );
}
