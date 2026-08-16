import { ModuleHubView } from "@/modules/module-hubs/components/module-hub-view";
import { loadModuleHubPage } from "@/modules/module-hubs/services/module-hub.service";

export default async function OperationsHubPage() {
  const hub = await loadModuleHubPage("operations");
  return <ModuleHubView hub={hub} links={hub.links} analytics={hub.analytics} />;
}
