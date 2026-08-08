import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

/**
 * Bounded export of organization operational data for offboarding / support.
 * Not a full DB dump — counts + key settings for lifecycle handoff.
 */
export async function exportOrganizationLifecycleSummary(
  platformAdmin: PlatformAdmin,
  orgId: string
): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, status, currency, country, timezone, custom_domain, custom_domain_status, created_at, settings"
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error || !org) throw new Error(error?.message ?? "الشركة غير موجودة");

  const [
    stores,
    users,
    products,
    customers,
    orders,
  ] = await Promise.all([
    admin.from("stores").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in(
        "store_id",
        (
          await admin.from("stores").select("id").eq("org_id", orgId)
        ).data?.map((s) => s.id) ?? []
      ),
  ]);

  const summary = {
    exportedAt: new Date().toISOString(),
    organization: org,
    counts: {
      stores: stores.count ?? 0,
      users: users.count ?? 0,
      products: products.count ?? 0,
      customers: customers.count ?? 0,
      orders: orders.count ?? 0,
    },
  };

  await auditAs(platformAdmin, {
    action: "org.lifecycle_export",
    entityType: "organization",
    entityId: orgId,
    metadata: { counts: summary.counts },
  });

  return summary;
}
