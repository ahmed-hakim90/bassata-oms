import { AccessDenied } from "@/components/Velora/access-denied";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import { AuthError } from "@/lib/auth/auth-error";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { listCertificatesWithDetails } from "@/modules/purchases/services/customs-certificate.service";
import { listSuppliers } from "@/modules/purchases/services/supplier.service";
import { CustomsCertificatesPage } from "@/modules/purchases/components/customs-certificates-page";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";

export default async function CustomsCertificatesRoute() {
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
    const [org, certificates, suppliers] = await Promise.all([
      orgRepo.getOrganization(),
      listCertificatesWithDetails({ storeId }),
      listSuppliers(),
    ]);
    return (
      <CustomsCertificatesPage
        certificates={certificates}
        suppliers={suppliers}
        currency={org.currency}
      />
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return <AccessDenied title="غير مسموح" description={e.message} />;
    }
    throw e;
  }
}
