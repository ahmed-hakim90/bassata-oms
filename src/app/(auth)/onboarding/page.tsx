import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getOnboardingAccess } from "@/modules/onboarding/actions/onboarding.actions";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

export default async function OnboardingPage() {
  const access = await getOnboardingAccess();
  const user = await getCurrentUser();

  if (!access.canAccess) {
    if (user) redirect("/");
    redirect("/login");
  }

  if (access.hasOrganization && user && !access.isBootstrapAdmin) {
    redirect("/");
  }

  return (
    <OnboardingWizard
      hasOrganization={access.hasOrganization}
      isBootstrapAdmin={access.isBootstrapAdmin}
    />
  );
}
