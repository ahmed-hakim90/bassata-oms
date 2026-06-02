import type { UserRole } from "@/lib/constants";
import { getValidatedActiveStoreId, requireAuth } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrgId } from "@/lib/repositories/organization.repository";

export interface TenantContext {
  organization_id: string;
  store_id: string;
  user_id: string;
  role: UserRole;
}

export async function getCurrentTenantContext(): Promise<TenantContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const [organizationId, storeId] = await Promise.all([
      getOrgId(),
      getValidatedActiveStoreId(),
    ]);
    return {
      organization_id: organizationId,
      store_id: storeId,
      user_id: user.id,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function requireTenantContext(): Promise<TenantContext> {
  const user = await requireAuth();
  const organizationId = await getOrgId();
  const storeId = await getValidatedActiveStoreId();
  return {
    organization_id: organizationId,
    store_id: storeId,
    user_id: user.id,
    role: user.role,
  };
}
