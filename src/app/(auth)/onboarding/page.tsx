import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { getPendingInviteByToken } from "@/modules/platform/services/platform.service";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const inviteToken = typeof params.invite === "string" ? params.invite : "";
  const invite = inviteToken ? await getPendingInviteByToken(inviteToken) : null;

  if (!invite) {
    return (
      <OperationalCard title="Company invite required">
        <p className="text-sm text-muted-foreground">
          Onboarding is available only from an active owner invite created by a platform
          administrator.
        </p>
      </OperationalCard>
    );
  }

  return (
    <OnboardingWizard
      inviteToken={inviteToken}
      inviteOrgName={invite.orgName}
      inviteOwnerName={invite.ownerName}
      inviteOwnerEmail={invite.ownerEmail}
    />
  );
}
