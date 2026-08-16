import { ModuleHubView } from "@/modules/module-hubs/components/module-hub-view";
import { loadModuleHubPage } from "@/modules/module-hubs/services/module-hub.service";

export default async function CustomersHubPage() {
  const hub = await loadModuleHubPage("customers");
  return <ModuleHubView hub={hub} links={hub.links} analytics={hub.analytics} />;
}
