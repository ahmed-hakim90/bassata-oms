import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapPurchase, mapPurchaseLine, mapSupplier } from "@/lib/repositories/mappers";
import type { PurchaseInvoice, PurchaseInvoiceLine, Supplier } from "@/lib/types";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { listStores } from "@/lib/repositories/store.repository";

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

export async function listSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db.from("suppliers").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listSuppliers");
  return (data ?? []).map(mapSupplier);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getSupplier");
  return data ? mapSupplier(data) : null;
}

export async function listPurchaseInvoicesForStore(
  storeId: string,
  options?: { supplierId?: string }
): Promise<PurchaseInvoice[]> {
  const storeIds = await orgStoreIds();
  if (!storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db
    .from("purchase_invoices")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["received", "cancelled"]);
  if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listPurchaseInvoicesForStore");
  return (data ?? []).map(mapPurchase);
}

export async function createSupplier(input: Omit<Supplier, "id" | "org_id">): Promise<Supplier> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("suppliers")
    .insert({ org_id: orgId, ...input })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createSupplier");
  return mapSupplier(data);
}

export async function updateSupplier(
  id: string,
  patch: Partial<Supplier>
): Promise<Supplier | null> {
  const db = await getDb();
  const { data, error } = await db.from("suppliers").update(patch).eq("id", id).select().maybeSingle();
  if (error) throwDbError(error, "updateSupplier");
  return data ? mapSupplier(data) : null;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const db = await getDb();
  const { error } = await db.from("suppliers").delete().eq("id", id);
  if (error) throwDbError(error, "deleteSupplier");
  return true;
}

export async function listPurchases(storeId?: string): Promise<PurchaseInvoice[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (storeId && !storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db
    .from("purchase_invoices")
    .select("*")
    .in("store_id", storeIds)
    .order("created_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listPurchases");
  return (data ?? []).map(mapPurchase);
}

export async function getPurchase(id: string): Promise<PurchaseInvoice | null> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return null;

  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoices")
    .select("*")
    .eq("id", id)
    .in("store_id", storeIds)
    .maybeSingle();
  if (error) throwDbError(error, "getPurchase");
  return data ? mapPurchase(data) : null;
}

export async function getPurchaseLine(id: string): Promise<PurchaseInvoiceLine | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDbError(error, "getPurchaseLine");
  return data ? mapPurchaseLine(data) : null;
}

export async function getPurchaseLines(invoiceId: string): Promise<PurchaseInvoiceLine[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throwDbError(error, "getPurchaseLines");
  return (data ?? []).map(mapPurchaseLine);
}

/** Batch-load lines for many invoices — avoids N+1 on purchase list/history. */
export async function getPurchaseLinesForInvoices(
  invoiceIds: string[]
): Promise<PurchaseInvoiceLine[]> {
  if (invoiceIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .select("*")
    .in("invoice_id", invoiceIds);
  if (error) throwDbError(error, "getPurchaseLinesForInvoices");
  return (data ?? []).map(mapPurchaseLine);
}

/**
 * Received-purchase hints for specific products only — used to pick last supplier
 * without loading the entire purchase history.
 */
export async function listReceivedSupplierHintsForProducts(productIds: string[]): Promise<
  Array<{
    supplierId: string;
    status: PurchaseInvoice["status"];
    receivedAt: string | null;
    createdAt: string;
    lines: Array<{ productId: string }>;
  }>
> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .select(
      `
      product_id,
      invoice_id,
      purchase_invoices!inner (
        supplier_id,
        status,
        received_at,
        created_at,
        store_id
      )
    `
    )
    .in("product_id", uniqueIds)
    .eq("purchase_invoices.status", "received")
    .in("purchase_invoices.store_id", storeIds)
    .limit(2000);
  if (error) throwDbError(error, "listReceivedSupplierHintsForProducts");

  type InvoiceEmbed = {
    supplier_id: string;
    status: PurchaseInvoice["status"];
    received_at: string | null;
    created_at: string;
    store_id: string;
  };

  const byInvoice = new Map<
    string,
    {
      supplierId: string;
      status: PurchaseInvoice["status"];
      receivedAt: string | null;
      createdAt: string;
      lines: Array<{ productId: string }>;
    }
  >();

  for (const row of data ?? []) {
    const invoiceRaw = row.purchase_invoices as InvoiceEmbed | InvoiceEmbed[] | null;
    const invoice = Array.isArray(invoiceRaw) ? invoiceRaw[0] : invoiceRaw;
    if (!invoice) continue;
    const invoiceId = String(row.invoice_id);
    const bucket = byInvoice.get(invoiceId) ?? {
      supplierId: invoice.supplier_id,
      status: invoice.status,
      receivedAt: invoice.received_at,
      createdAt: invoice.created_at,
      lines: [],
    };
    bucket.lines.push({ productId: String(row.product_id) });
    byInvoice.set(invoiceId, bucket);
  }

  return [...byInvoice.values()];
}

export async function insertPurchase(
  invoice: Omit<PurchaseInvoice, "id" | "created_at">,
  lines: Omit<PurchaseInvoiceLine, "id" | "invoice_id">[]
): Promise<PurchaseInvoice> {
  const db = await getDb();
  const { data, error } = await db.from("purchase_invoices").insert(invoice).select().single();
  if (error || !data) throwDbError(error, "insertPurchase");
  if (lines.length > 0) {
    const { error: lineError } = await db.from("purchase_invoice_lines").insert(
      lines.map((l) => ({ ...l, invoice_id: data.id }))
    );
    if (lineError) throwDbError(lineError, "insertPurchase.lines");
  }
  return mapPurchase(data);
}

export async function updatePurchase(
  id: string,
  patch: Partial<PurchaseInvoice>
): Promise<PurchaseInvoice | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoices")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updatePurchase");
  return data ? mapPurchase(data) : null;
}

export async function addPurchaseLine(
  line: Omit<PurchaseInvoiceLine, "id" | "landed_unit_cost" | "landed_line_total"> &
    Partial<Pick<PurchaseInvoiceLine, "landed_unit_cost" | "landed_line_total">>
): Promise<PurchaseInvoiceLine> {
  const db = await getDb();
  const { data, error } = await db.from("purchase_invoice_lines").insert(line).select().single();
  if (error || !data) throwDbError(error, "addPurchaseLine");
  return mapPurchaseLine(data);
}

export async function updatePurchaseLine(
  id: string,
  patch: Partial<PurchaseInvoiceLine>
): Promise<PurchaseInvoiceLine | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updatePurchaseLine");
  return data ? mapPurchaseLine(data) : null;
}

export async function deletePurchaseLine(id: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("purchase_invoice_lines").delete().eq("id", id);
  if (error) throwDbError(error, "deletePurchaseLine");
}

export async function recalcPurchaseTotals(invoiceId: string): Promise<void> {
  const invoice = await getPurchase(invoiceId);
  const lines = await getPurchaseLines(invoiceId);
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const extraCost = invoice?.extra_cost ?? 0;
  await updatePurchase(invoiceId, { subtotal, tax: 0, total: subtotal + extraCost });
}

export async function deletePurchaseLinesForInvoice(invoiceId: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("purchase_invoice_lines").delete().eq("invoice_id", invoiceId);
  if (error) throwDbError(error, "deletePurchaseLinesForInvoice");
}

export async function deletePurchase(id: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("purchase_invoices").delete().eq("id", id);
  if (error) throwDbError(error, "deletePurchase");
}
