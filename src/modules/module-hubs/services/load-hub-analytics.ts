import { AuthError } from "@/lib/auth/auth-error";
import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getOrganization } from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import type { ModuleHubId } from "@/modules/module-hubs/lib/module-hub-catalog";
import type { HubAnalyticsPayload } from "@/modules/module-hubs/lib/hub-analytics-types";
import {
  buildAccountingHubAnalytics,
  buildAdminHubAnalytics,
  buildCatalogHubAnalytics,
  buildCustomersHubAnalytics,
  buildOperationsHubAnalytics,
  buildPurchasingHubAnalytics,
  buildSalesDocumentsHubAnalytics,
} from "@/modules/module-hubs/lib/build-hub-analytics";

async function safeStoreId(): Promise<string | null> {
  try {
    return await getValidatedActiveStoreId();
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

async function loadOperationsAnalytics(): Promise<HubAnalyticsPayload | null> {
  const storeId = await safeStoreId();
  if (!storeId) return null;
  const [
    { getLiveStats, getActiveSessions },
    { listOnlineOrders },
    { buildOnlineOrdersGlance },
    org,
  ] = await Promise.all([
    import("@/modules/dashboard/services/dashboard.service"),
    import("@/modules/online-orders/services/online-order.service"),
    import("@/modules/online-orders/lib/online-orders-glance"),
    getOrganization(),
  ]);

  const [stats, sessions, onlineOrders] = await Promise.all([
    getLiveStats(storeId),
    getActiveSessions(storeId),
    listOnlineOrders({ storeId, limit: 100 }).catch(() => []),
  ]);
  const onlineGlance = buildOnlineOrdersGlance({ orders: onlineOrders });

  return buildOperationsHubAnalytics({
    currency: org.currency,
    todaySales: stats.todaySales,
    todayOrders: stats.todayOrders,
    avgTicket: stats.avgTicket,
    openSessions: sessions.length,
    onlineActive: onlineGlance.active,
    salesSparkline: stats.salesSparkline,
  });
}

async function loadSalesDocumentsAnalytics(): Promise<HubAnalyticsPayload | null> {
  const storeId = await safeStoreId();
  if (!storeId) return null;
  try {
    const { listSalesDocuments, assertSalesInvoiceAccess } = await import(
      "@/modules/sales-invoices/services/sales-invoice.service"
    );
    const { requireAuth } = await import("@/lib/auth/guards");
    const user = await requireAuth();
    await assertSalesInvoiceAccess(user);
    const org = await getOrganization();

    const kinds = [
      { kind: "quotation" as const, label: "عروض" },
      { kind: "sales_order" as const, label: "أوامر" },
      { kind: "sales_invoice" as const, label: "فواتير" },
      { kind: "credit_note" as const, label: "إشعارات" },
    ];

    const docsByKind = await Promise.all(
      kinds.map(async ({ kind, label }) => {
        const docs = await listSalesDocuments(storeId, kind);
        return { label, docs };
      })
    );

    let draftCount = 0;
    let issuedCount = 0;
    let openTotal = 0;
    const byKind = docsByKind.map(({ label, docs }) => {
      for (const doc of docs) {
        const status = doc.document_status ?? "draft";
        if (status === "draft") draftCount += 1;
        if (
          status === "issued" ||
          status === "confirmed" ||
          status === "accepted" ||
          status === "sent"
        ) {
          issuedCount += 1;
        }
        if (status !== "delivered" && status !== "cancelled" && status !== "rejected") {
          openTotal += doc.total ?? 0;
        }
      }
      return { label, count: docs.length };
    });

    return buildSalesDocumentsHubAnalytics({
      currency: org.currency,
      byKind,
      openTotal,
      draftCount,
      issuedCount,
    });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

async function loadCatalogAnalytics(): Promise<HubAnalyticsPayload | null> {
  const storeId = await safeStoreId();
  if (!storeId) return null;
  const [{ getDashboardInventory }, catalogRepo, org] = await Promise.all([
    import("@/modules/dashboard/services/dashboard.service"),
    import("@/lib/repositories/catalog.repository"),
    getOrganization(),
  ]);
  const [inventory, products] = await Promise.all([
    getDashboardInventory(storeId),
    catalogRepo.listProducts({ activeOnly: true }),
  ]);
  return buildCatalogHubAnalytics({
    currency: org.currency,
    totalSkus: products.length,
    lowStock: inventory.lowStock.length,
    nearExpiry: inventory.nearExpiryCount,
    sellValue: inventory.inventorySellValue,
  });
}

async function loadPurchasingAnalytics(): Promise<HubAnalyticsPayload | null> {
  const storeId = await safeStoreId();
  if (!storeId) return null;
  try {
    const [
      { listPurchases },
      { listSupplierSummaries },
      paymentRepo,
      { getSupplierAgingSide },
      org,
    ] = await Promise.all([
      import("@/modules/purchases/services/purchase.service"),
      import("@/modules/suppliers/services/supplier.service"),
      import("@/lib/repositories/supplier-payment.repository"),
      import("@/modules/reports/services/aging-report.service"),
      getOrganization(),
    ]);

    const [purchases, summaries, payments, aging] = await Promise.all([
      listPurchases(storeId),
      listSupplierSummaries(storeId),
      paymentRepo.listPaymentsForStore(storeId),
      getSupplierAgingSide(storeId).catch(() => null),
    ]);

    const draftCount = purchases.filter((p) => p.status === "draft").length;
    const receivedCount = purchases.filter((p) => p.status === "received").length;
    const supplierDue = summaries.reduce(
      (sum, s) => sum + Math.max(0, s.balanceDue),
      0
    );
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const paid30d = payments
      .filter((p) => !p.voided_at && new Date(p.paid_at).getTime() >= from)
      .reduce((sum, p) => sum + p.amount, 0);

    return buildPurchasingHubAnalytics({
      currency: org.currency,
      draftCount,
      receivedCount,
      supplierDue,
      paid30d,
      agingBuckets: aging?.buckets ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

async function loadCustomersAnalytics(): Promise<HubAnalyticsPayload | null> {
  try {
    const { getCustomersData } = await import(
      "@/modules/customers/actions/customer.actions"
    );
    const data = await getCustomersData();
    const outstanding = data.customers.reduce(
      (sum, c) => sum + Math.max(0, c.account_balance ?? 0),
      0
    );
    return buildCustomersHubAnalytics({
      currency: data.currency,
      customerCount: data.customers.length,
      outstanding,
      collected30d: data.glance?.collected30d ?? 0,
      partiesWithBalance: data.glance?.partiesWithBalance ?? 0,
      agingBuckets: data.glance?.agingBuckets ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

async function loadAccountingAnalytics(): Promise<HubAnalyticsPayload | null> {
  try {
    const { getAccountingOverview } = await import(
      "@/modules/accounting/services/accounting-overview.service"
    );
    const overview = await getAccountingOverview();
    return buildAccountingHubAnalytics(overview);
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

async function loadAdminAnalytics(): Promise<HubAnalyticsPayload | null> {
  try {
    const { listDevices } = await import("@/modules/system/services/users.service");
    const { buildDevicesGlance } = await import(
      "@/modules/devices/lib/devices-glance"
    );
    const [devices, stores] = await Promise.all([
      listDevices(),
      storeRepo.listStores(),
    ]);
    const storeNames = Object.fromEntries(stores.map((s) => [s.id, s.name]));
    const glance = buildDevicesGlance({ devices, storeNames });
    return buildAdminHubAnalytics({
      totalDevices: glance.total,
      activeDevices: glance.active,
      seenRecently: glance.seenRecently,
      staleOrNever: glance.staleOrNever,
      byStoreChart: glance.byStoreChart,
    });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

/** Fail-soft analytics for module hubs — never blocks the link board. */
export async function loadHubAnalytics(
  hubId: ModuleHubId
): Promise<HubAnalyticsPayload | null> {
  try {
    switch (hubId) {
      case "operations":
        return await loadOperationsAnalytics();
      case "sales-documents":
        return await loadSalesDocumentsAnalytics();
      case "catalog":
        return await loadCatalogAnalytics();
      case "purchasing":
        return await loadPurchasingAnalytics();
      case "customers":
        return await loadCustomersAnalytics();
      case "accounting":
        return await loadAccountingAnalytics();
      case "admin":
        return await loadAdminAnalytics();
      default:
        return null;
    }
  } catch {
    return null;
  }
}
