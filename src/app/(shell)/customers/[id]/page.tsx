import { notFound } from "next/navigation";
import { getCustomerProfileData } from "@/modules/customers/actions/customer.actions";
import { CustomerDetailPage } from "@/modules/customers/components/customer-detail-page";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { getFeatureFlags } from "@/modules/system/services/settings.service";

export default async function CustomerDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ collect?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [data, flags] = await Promise.all([getCustomerProfileData(id), getFeatureFlags()]);
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

  const canVoidPayment = user?.role === "owner" || user?.role === "manager";

  return (
    <CustomerDetailPage
      profile={data.profile}
      ledger={data.ledger}
      statement={data.statement}
      canCollect={canCollect}
      canEdit={canEdit}
      canVoidPayment={canVoidPayment}
      creditSalesEnabled={flags.credit_sales === true}
      initialCollectOpen={query.collect === "1" && canCollect}
    />
  );
}
