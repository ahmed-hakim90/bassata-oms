import { PageHeader } from "@/components/Velora/page-header";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";

export default function AccountPage() {
  return (
    <div className="space-y-3">
      <PageHeader title="الحساب" description="إدارة بيانات تسجيل الدخول" />
      <ChangePasswordForm />
    </div>
  );
}
