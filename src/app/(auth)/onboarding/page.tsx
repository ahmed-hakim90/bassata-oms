import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  return <OnboardingWizard initialInviteToken={params.invite?.trim() ?? ""} />;
}
