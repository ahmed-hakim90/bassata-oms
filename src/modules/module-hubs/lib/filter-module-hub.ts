import {
  navItemAllowed,
  type NavAccessOptions,
} from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import {
  MODULE_HUBS,
  type ModuleHubDefinition,
  type ModuleHubId,
  type ModuleHubLink,
} from "@/modules/module-hubs/lib/module-hub-catalog";

export function filterModuleHubLinks(
  links: readonly ModuleHubLink[],
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
): ModuleHubLink[] {
  return links.filter((link) => {
    if (link.requiresFlag && flags?.[link.requiresFlag] === false) {
      return false;
    }
    // Import workflows sit under purchasing — hide when purchases module is off.
    if (
      link.requiresFlag === "purchase_imports" &&
      flags?.purchases === false
    ) {
      return false;
    }
    return navItemAllowed(link.href, role, permissions, flags, options);
  });
}

export function getFilteredModuleHub(
  hubId: ModuleHubId,
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
): ModuleHubDefinition & { links: ModuleHubLink[] } {
  const hub = MODULE_HUBS[hubId];
  return {
    ...hub,
    links: filterModuleHubLinks(hub.links, role, permissions, flags, options),
  };
}
