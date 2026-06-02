import { notFound } from "next/navigation";
import { getCustomerProfileData } from "@/modules/customers/actions/customer.actions";
import { CustomerProfileView } from "@/modules/customers/components/customer-profile";
import { CustomerAccountPanel } from "@/modules/customers/components/customer-account-panel";
import { CustomerCreditSettings } from "@/modules/customers/components/customer-credit-settings";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";

export default async function CustomerDetailPage({
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
    permissions.has("customer_payment_receive");
  const canEditCustomer =
    user?.role === "owner" ||
    user?.role === "manager" ||
    permissions.has("customer_manage");

  return (
    <>
      <PageHeader title={data.profile.name} description={data.profile.phone} />
      <div className="space-y-6">
        <CustomerCreditSettings
          customerId={data.profile.id}
          creditLimit={data.profile.credit_limit}
          paymentTerms={data.profile.payment_terms}
          canEdit={canEditCustomer}
        />
        <CustomerAccountPanel
          customerId={data.profile.id}
          accountBalance={data.profile.account_balance}
          creditLimit={data.profile.credit_limit}
          paymentTerms={data.profile.payment_terms}
          statement={data.statement}
          canCollect={canCollect}
        />
        <CustomerProfileView profile={data.profile} ledger={data.ledger} />
      </div>
    </>
  );
}
