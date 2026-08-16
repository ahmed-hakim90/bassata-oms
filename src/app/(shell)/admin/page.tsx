import { ModuleHubView } from "@/modules/module-hubs/components/module-hub-view";
import { loadModuleHubPage } from "@/modules/module-hubs/services/module-hub.service";

export default async function AdminHubPage() {
  const hub = await loadModuleHubPage("admin");
  return <ModuleHubView hub={hub} links={hub.links} analytics={hub.analytics} />;
}
