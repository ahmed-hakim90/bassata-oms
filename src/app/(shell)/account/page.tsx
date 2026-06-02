import { PageHeader } from "@/components/SweetFlow/page-header";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Manage your sign-in credentials" />
      <ChangePasswordForm />
    </div>
  );
}
