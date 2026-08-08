import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { getMenuThemeCatalog } from "@/modules/platform/services/platform-menu-themes.service";
import { PlatformMenuThemesConsole } from "@/modules/platform/components/platform-menu-themes-console";

export default async function PlatformMenuThemesPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;
  const catalog = await getMenuThemeCatalog();
  return <PlatformMenuThemesConsole initialCatalog={catalog} />;
}
