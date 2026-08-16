import { AccessDenied } from "@/components/Velora/access-denied";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import { AuthError } from "@/lib/auth/auth-error";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { listContainersWithLines } from "@/modules/purchases/services/purchase-container.service";
import { ContainersPage } from "@/modules/purchases/components/containers-page";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";

export default async function ContainersRoute() {
  try {
    await requireFeature("purchases");
    if (!(await isFeatureEnabled("purchase_imports"))) {
      return (
        <AccessDenied
          title="استيراد الحاويات مش مفعّل"
          description="فعّل «استيراد الحاويات والشهادات» من إعدادات النظام — مش تبع أي نشاط تلقائي."
        />
      );
    }
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    const [org, containers] = await Promise.all([
      orgRepo.getOrganization(),
      listContainersWithLines({ storeId }),
    ]);
    return <ContainersPage containers={containers} currency={org.currency} />;
  } catch (e) {
    if (e instanceof AuthError) {
      return <AccessDenied title="غير مسموح" description={e.message} />;
    }
    throw e;
  }
}
