import { notFound } from "next/navigation";
import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import {
  getOrganizationForPlatform,
  getOrganizationHealth,
} from "@/modules/platform/services/platform-org.service";
import { getPlatformOrgConfig } from "@/modules/platform/services/platform-org-config.service";
import {
  getPlatformPlan,
  getPlatformUsage,
} from "@/modules/platform/services/platform-plan.service";
import { getPlatformWebhookConfig } from "@/modules/platform/services/platform-webhooks.service";
import { getOrgCustomDomain } from "@/modules/platform/services/platform-custom-domain.service";
import { getOrgMenuThemeAccess } from "@/modules/platform/services/platform-menu-themes.service";
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

  const [health, config, plan, usage, webhook, customDomain, menuThemes] =
    await Promise.all([
      getOrganizationHealth(organization.id),
      getPlatformOrgConfig(organization.id),
      getPlatformPlan(organization.id),
      getPlatformUsage(organization.id),
      getPlatformWebhookConfig(organization.id),
      getOrgCustomDomain(organization.id),
      getOrgMenuThemeAccess(organization.id),
    ]);

  return (
    <PlatformOrgDetail
      organization={organization}
      health={health}
      config={config}
      plan={plan}
      usage={usage}
      webhook={webhook}
      customDomain={customDomain}
      menuThemeRows={menuThemes.rows}
      menuThemeEntitlements={menuThemes.entitlements}
    />
  );
}
