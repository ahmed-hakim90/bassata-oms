import { PlatformDashboard } from "@/modules/platform/components/platform-ui";
import {
  listCompanies,
  listCompanyInvites,
} from "@/modules/platform/services/platform.service";

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const [companies, invites] = await Promise.all([listCompanies(), listCompanyInvites()]);
  return (
    <PlatformDashboard
      companies={companies}
      invites={invites}
      inviteLink={typeof params.invite === "string" ? params.invite : undefined}
    />
  );
}
