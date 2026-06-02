import { redirect } from "next/navigation";
import { LoginForm } from "@/modules/auth/components/login-form";
import { deploymentHasOrganization } from "@/modules/onboarding/services/bootstrap.service";

export default async function LoginPage() {
  const hasOrganization = await deploymentHasOrganization();
  if (!hasOrganization) {
    redirect("/onboarding");
  }

  return <LoginForm />;
}
