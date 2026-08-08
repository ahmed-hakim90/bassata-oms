import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

const PAGE_SIZE = 500;
const ID_CHUNK = 200;
/** Hard cap per high-volume table to keep platform exports within function limits. */
const MAX_ROWS_PER_TABLE = 20_000;

type ExportSectionMeta = {
  rowCount: number;
  truncated: boolean;
  maxRows: number;
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function fetchPagedTable(
  queryFactory: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<{ rows: unknown[]; meta: ExportSectionMeta }> {
  const rows: unknown[] = [];

  for (let offset = 0; offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
    const to = Math.min(offset + PAGE_SIZE - 1, MAX_ROWS_PER_TABLE - 1);
    const { data, error } = await queryFactory(offset, to);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return {
        rows,
        meta: { rowCount: rows.length, truncated: false, maxRows: MAX_ROWS_PER_TABLE },
      };
    }
  }

  return {
    rows,
    meta: { rowCount: rows.length, truncated: true, maxRows: MAX_ROWS_PER_TABLE },
  };
}

async function fetchByIdChunks(
  ids: string[],
  queryFactory: (
    chunk: string[],
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<{ rows: unknown[]; meta: ExportSectionMeta }> {
  if (ids.length === 0) {
    return {
      rows: [],
      meta: { rowCount: 0, truncated: false, maxRows: MAX_ROWS_PER_TABLE },
    };
  }

  const rows: unknown[] = [];
  let truncated = false;

  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let offset = 0; offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
      if (rows.length >= MAX_ROWS_PER_TABLE) {
        truncated = true;
        break;
      }
      const remaining = MAX_ROWS_PER_TABLE - rows.length;
      const pageSize = Math.min(PAGE_SIZE, remaining);
      const to = offset + pageSize - 1;
      const { data, error } = await queryFactory(chunk, offset, to);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    if (truncated) break;
  }

  return {
    rows,
    meta: { rowCount: rows.length, truncated, maxRows: MAX_ROWS_PER_TABLE },
  };
}

function emptySection(): { rows: unknown[]; meta: ExportSectionMeta } {
  return {
    rows: [],
    meta: { rowCount: 0, truncated: false, maxRows: MAX_ROWS_PER_TABLE },
  };
}

/**
 * Full tenant operational dump for support / offboarding.
 * Storage buckets (org-assets) are not included — DB + settings only.
 * High-volume tables may truncate at MAX_ROWS_PER_TABLE.
 */
export async function exportOrganizationFullData(
  platformAdmin: PlatformAdmin,
  orgId: string
): Promise<Record<string, unknown>> {
  const admin: AdminClient = createAdminClient();

  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError || !organization) {
    throw new Error(orgError?.message ?? "الشركة غير موجودة");
  }

  const storesRes = await fetchPagedTable((from, to) =>
    admin.from("stores").select("*").eq("org_id", orgId).range(from, to)
  );
  const storeIds = (storesRes.rows as { id: string }[]).map((s) => s.id);

  const usersRes = await fetchPagedTable((from, to) =>
    admin
      .from("users")
      .select("id, org_id, auth_user_id, name, email, role, is_active, created_at")
      .eq("org_id", orgId)
      .range(from, to)
  );

  const appSettingsRes = await fetchPagedTable((from, to) =>
    admin.from("app_settings").select("key, value, org_id").eq("org_id", orgId).range(from, to)
  );

  const categoriesRes = await fetchPagedTable((from, to) =>
    admin.from("categories").select("*").eq("org_id", orgId).range(from, to)
  );

  const productsRes = await fetchPagedTable((from, to) =>
    admin.from("products").select("*").eq("org_id", orgId).range(from, to)
  );
  const productIds = (productsRes.rows as { id: string }[]).map((p) => p.id);

  const customersRes = await fetchPagedTable((from, to) =>
    admin.from("customers").select("*").eq("org_id", orgId).range(from, to)
  );

  const suppliersRes = await fetchPagedTable((from, to) =>
    admin.from("suppliers").select("*").eq("org_id", orgId).range(from, to)
  );

  const expenseCategoriesRes = await fetchPagedTable((from, to) =>
    admin.from("expense_categories").select("*").eq("org_id", orgId).range(from, to)
  );

  const expensesRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin.from("expenses").select("*").in("store_id", chunk).range(from, to)
        )
      : emptySection();

  const costCentersRes = await fetchPagedTable((from, to) =>
    admin.from("cost_centers").select("*").eq("org_id", orgId).range(from, to)
  );

  const warehousesRes = await fetchPagedTable((from, to) =>
    admin.from("warehouses").select("*").eq("org_id", orgId).range(from, to)
  );

  const devicesRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin.from("devices").select("*").in("store_id", chunk).range(from, to)
        )
      : emptySection();

  const stockLevelsRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin.from("stock_levels").select("*").in("store_id", chunk).range(from, to)
        )
      : emptySection();

  const inventoryMovementsRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin
            .from("inventory_movements")
            .select("*")
            .in("store_id", chunk)
            .order("created_at", { ascending: false })
            .range(from, to)
        )
      : emptySection();

  const ordersRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin
            .from("orders")
            .select("*")
            .in("store_id", chunk)
            .order("created_at", { ascending: false })
            .range(from, to)
        )
      : emptySection();
  const orderIds = (ordersRes.rows as { id: string }[]).map((o) => o.id);

  const orderItemsRes = await fetchByIdChunks(orderIds, (chunk, from, to) =>
    admin.from("order_items").select("*").in("order_id", chunk).range(from, to)
  );

  const orderPaymentsRes = await fetchByIdChunks(orderIds, (chunk, from, to) =>
    admin.from("order_payments").select("*").in("order_id", chunk).range(from, to)
  );

  const onlineOrdersRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin
            .from("online_orders")
            .select("*")
            .in("store_id", chunk)
            .order("created_at", { ascending: false })
            .range(from, to)
        )
      : emptySection();
  const onlineOrderIds = (onlineOrdersRes.rows as { id: string }[]).map((o) => o.id);

  const onlineOrderItemsRes = await fetchByIdChunks(onlineOrderIds, (chunk, from, to) =>
    admin.from("online_order_items").select("*").in("online_order_id", chunk).range(from, to)
  );

  const purchasesRes =
    storeIds.length > 0
      ? await fetchByIdChunks(storeIds, (chunk, from, to) =>
          admin
            .from("purchase_invoices")
            .select("*")
            .in("store_id", chunk)
            .order("created_at", { ascending: false })
            .range(from, to)
        )
      : emptySection();
  const purchaseIds = (purchasesRes.rows as { id: string }[]).map((p) => p.id);

  const purchaseLinesRes = await fetchByIdChunks(purchaseIds, (chunk, from, to) =>
    admin.from("purchase_invoice_lines").select("*").in("invoice_id", chunk).range(from, to)
  );

  const variantsRes = await fetchByIdChunks(productIds, (chunk, from, to) =>
    admin.from("product_variants").select("*").in("product_id", chunk).range(from, to)
  );

  const recipesRes = await fetchPagedTable((from, to) =>
    admin.from("product_recipes").select("*").eq("org_id", orgId).range(from, to)
  );
  const recipeIds = (recipesRes.rows as { id: string }[]).map((r) => r.id);

  const recipeLinesRes = await fetchByIdChunks(recipeIds, (chunk, from, to) =>
    admin.from("product_recipe_lines").select("*").in("recipe_id", chunk).range(from, to)
  );

  const loyaltyRulesRes = await fetchPagedTable((from, to) =>
    admin.from("loyalty_rules").select("*").eq("org_id", orgId).range(from, to)
  );

  const glAccountsRes = await fetchPagedTable((from, to) =>
    admin.from("gl_accounts").select("*").eq("org_id", orgId).range(from, to)
  );

  const sections = {
    stores: storesRes,
    users: usersRes,
    app_settings: appSettingsRes,
    categories: categoriesRes,
    products: productsRes,
    product_variants: variantsRes,
    product_recipes: recipesRes,
    product_recipe_lines: recipeLinesRes,
    customers: customersRes,
    suppliers: suppliersRes,
    expense_categories: expenseCategoriesRes,
    expenses: expensesRes,
    cost_centers: costCentersRes,
    warehouses: warehousesRes,
    devices: devicesRes,
    stock_levels: stockLevelsRes,
    inventory_movements: inventoryMovementsRes,
    orders: ordersRes,
    order_items: orderItemsRes,
    order_payments: orderPaymentsRes,
    online_orders: onlineOrdersRes,
    online_order_items: onlineOrderItemsRes,
    purchase_invoices: purchasesRes,
    purchase_invoice_lines: purchaseLinesRes,
    loyalty_rules: loyaltyRulesRes,
    gl_accounts: glAccountsRes,
  };

  const meta: Record<string, ExportSectionMeta> = {};
  const data: Record<string, unknown> = {};
  for (const [key, section] of Object.entries(sections)) {
    meta[key] = section.meta;
    data[key] = section.rows;
  }

  const payload = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    exportType: "full_tenant_data",
    organization,
    meta,
    data,
    notes: [
      "لا يشمل ملفات Storage (org-assets) ولا أسرار PIN/pairing.",
      `الجداول عالية الحجم مقطوعة عند ${MAX_ROWS_PER_TABLE} صف إن لزم.`,
      "للاستعادة استخدم مسار البنية التحتية (Supabase PITR) أو استيراد يدوي.",
    ],
  };

  await auditAs(platformAdmin, {
    action: "org.full_data_export",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      sections: Object.fromEntries(
        Object.entries(meta).map(([k, v]) => [k, { rowCount: v.rowCount, truncated: v.truncated }])
      ),
    },
  });

  return payload;
}
