import { notFound } from "next/navigation";
import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import {
  getOrganizationForPlatform,
  getOrganizationHealth,
} from "@/modules/platform/services/platform-org.service";
import { PlatformOrgDetail } from "@/modules/platform/components/platform-org-detail";

interface PlatformOrgPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlatformOrgPage({ params }: PlatformOrgPageProps) {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const { id } = await params;
  const organization = await getOrganizationForPlatform(id);
  if (!organization) notFound();

  const health = await getOrganizationHealth(organization.id);

  return <PlatformOrgDetail organization={organization} health={health} />;
}
