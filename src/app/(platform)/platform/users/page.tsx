import {
  listPlatformAdmins,
  resolvePlatformAdmin,
} from "@/modules/platform/services/platform-admin.service";
import {
  listPlatformOrgOptions,
  listPlatformTenantUsers,
} from "@/modules/platform/services/platform-users.service";
import { PlatformUsersConsole } from "@/modules/platform/components/platform-users-console";

export default async function PlatformUsersPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const [users, orgs, platformAdmins] = await Promise.all([
    listPlatformTenantUsers({ limit: 300 }),
    listPlatformOrgOptions(),
    listPlatformAdmins(),
  ]);

  return (
    <PlatformUsersConsole
      users={users}
      orgs={orgs}
      platformAdmins={platformAdmins}
    />
  );
}
