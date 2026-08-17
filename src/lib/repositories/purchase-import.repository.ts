import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { listStores } from "@/lib/repositories/store.repository";
import { chunkIds } from "@/lib/query-chunks";
import type {
  CustomsCertificateCostType,
  CustomsCertificateStatus,
  PurchaseContainerStatus,
} from "@/modules/purchases/lib/import-constants";

export type PurchaseContainerRow = {
  id: string;
  org_id: string;
  store_id: string;
  warehouse_id: string;
  purchase_order_id: string;
  customs_certificate_id: string | null;
  container_number: string;
  status: PurchaseContainerStatus;
  shipped_at: string | null;
  arrived_port_at: string | null;
  received_at: string | null;
  notes: string;
  created_by: string;
  created_at: string;
};

export type PurchaseContainerLineRow = {
  id: string;
  container_id: string;
  source_line_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
};

export type CustomsCertificateRow = {
  id: string;
  org_id: string;
  store_id: string;
  certificate_number: string;
  status: CustomsCertificateStatus;
  certificate_date: string;
  notes: string;
  created_by: string;
  created_at: string;
  closed_at: string | null;
};

export type CustomsCertificateCostRow = {
  id: string;
  certificate_id: string;
  cost_type: CustomsCertificateCostType;
  amount: number;
  payee_supplier_id: string | null;
  payment_method: "cash" | "card" | "wallet" | "other" | null;
  notes: string;
  posted_amount: number;
  created_by: string;
  created_at: string;
};

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

function mapContainer(row: Record<string, unknown>): PurchaseContainerRow {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    store_id: String(row.store_id),
    warehouse_id: String(row.warehouse_id),
    purchase_order_id: String(row.purchase_order_id),
    customs_certificate_id: row.customs_certificate_id
      ? String(row.customs_certificate_id)
      : null,
    container_number: String(row.container_number),
    status: row.status as PurchaseContainerStatus,
    shipped_at: row.shipped_at ? String(row.shipped_at) : null,
    arrived_port_at: row.arrived_port_at ? String(row.arrived_port_at) : null,
    received_at: row.received_at ? String(row.received_at) : null,
    notes: String(row.notes ?? ""),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  };
}

function mapContainerLine(row: Record<string, unknown>): PurchaseContainerLineRow {
  return {
    id: String(row.id),
    container_id: String(row.container_id),
    source_line_id: String(row.source_line_id),
    product_id: String(row.product_id),
    variant_id: row.variant_id ? String(row.variant_id) : null,
    quantity: Number(row.quantity),
    created_at: String(row.created_at),
  };
}

function mapCertificate(row: Record<string, unknown>): CustomsCertificateRow {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    store_id: String(row.store_id),
    certificate_number: String(row.certificate_number),
    status: row.status as CustomsCertificateStatus,
    certificate_date: String(row.certificate_date),
    notes: String(row.notes ?? ""),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    closed_at: row.closed_at ? String(row.closed_at) : null,
  };
}

function mapCost(row: Record<string, unknown>): CustomsCertificateCostRow {
  return {
    id: String(row.id),
    certificate_id: String(row.certificate_id),
    cost_type: row.cost_type as CustomsCertificateCostType,
    amount: Number(row.amount),
    payee_supplier_id: row.payee_supplier_id ? String(row.payee_supplier_id) : null,
    payment_method: (row.payment_method as CustomsCertificateCostRow["payment_method"]) ?? null,
    notes: String(row.notes ?? ""),
    posted_amount: Number(row.posted_amount ?? 0),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  };
}

export async function listContainers(options?: {
  storeId?: string;
  purchaseOrderId?: string;
  certificateId?: string;
  status?: PurchaseContainerStatus;
}): Promise<PurchaseContainerRow[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  const db = await getDb();
  let q = db.from("purchase_containers").select("*").in("store_id", storeIds);
  if (options?.storeId) q = q.eq("store_id", options.storeId);
  if (options?.purchaseOrderId) q = q.eq("purchase_order_id", options.purchaseOrderId);
  if (options?.certificateId) q = q.eq("customs_certificate_id", options.certificateId);
  if (options?.status) q = q.eq("status", options.status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throwDbError(error, "listContainers");
  return (data ?? []).map((row) => mapContainer(row as Record<string, unknown>));
}

export async function getContainer(id: string): Promise<PurchaseContainerRow | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("purchase_containers")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getContainer");
  return data ? mapContainer(data as Record<string, unknown>) : null;
}

export async function listContainerLines(
  containerIds: string[]
): Promise<PurchaseContainerLineRow[]> {
  if (containerIds.length === 0) return [];
  const db = await getDb();
  const rows: PurchaseContainerLineRow[] = [];
  for (const chunk of chunkIds(containerIds)) {
    const { data, error } = await db
      .from("purchase_container_lines")
      .select("*")
      .in("container_id", chunk);
    if (error) throwDbError(error, "listContainerLines");
    for (const row of data ?? []) {
      rows.push(mapContainerLine(row as Record<string, unknown>));
    }
  }
  return rows;
}

export async function insertContainer(
  input: Omit<PurchaseContainerRow, "id" | "created_at" | "org_id"> & { org_id?: string }
): Promise<PurchaseContainerRow> {
  const db = await getDb();
  const orgId = input.org_id ?? (await getOrgId());
  const { data, error } = await db
    .from("purchase_containers")
    .insert({
      org_id: orgId,
      store_id: input.store_id,
      warehouse_id: input.warehouse_id,
      purchase_order_id: input.purchase_order_id,
      customs_certificate_id: input.customs_certificate_id,
      container_number: input.container_number,
      status: input.status,
      shipped_at: input.shipped_at,
      arrived_port_at: input.arrived_port_at,
      received_at: input.received_at,
      notes: input.notes,
      created_by: input.created_by,
    } as never)
    .select()
    .single();
  if (error || !data) throwDbError(error, "insertContainer");
  return mapContainer(data as Record<string, unknown>);
}

export async function updateContainer(
  id: string,
  patch: Partial<
    Pick<
      PurchaseContainerRow,
      | "warehouse_id"
      | "customs_certificate_id"
      | "container_number"
      | "status"
      | "shipped_at"
      | "arrived_port_at"
      | "received_at"
      | "notes"
    >
  >
): Promise<PurchaseContainerRow | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("purchase_containers")
    .update(patch as never)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateContainer");
  return data ? mapContainer(data as Record<string, unknown>) : null;
}

export async function replaceContainerLines(
  containerId: string,
  lines: Omit<PurchaseContainerLineRow, "id" | "created_at" | "container_id">[]
): Promise<void> {
  const db = await getDb();
  const { error: delError } = await db
    .from("purchase_container_lines")
    .delete()
    .eq("container_id", containerId);
  if (delError) throwDbError(delError, "replaceContainerLines.delete");
  if (lines.length === 0) return;
  const { error } = await db.from("purchase_container_lines").insert(
    lines.map((line) => ({
      container_id: containerId,
      source_line_id: line.source_line_id,
      product_id: line.product_id,
      variant_id: line.variant_id,
      quantity: line.quantity,
    })) as never
  );
  if (error) throwDbError(error, "replaceContainerLines.insert");
}

export async function sumContainerQtyBySourceLine(
  purchaseOrderId: string,
  excludeContainerId?: string
): Promise<Map<string, number>> {
  const containers = await listContainers({ purchaseOrderId });
  const active = containers.filter(
    (c) => c.status !== "cancelled" && c.id !== excludeContainerId
  );
  const lines = await listContainerLines(active.map((c) => c.id));
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.source_line_id, (totals.get(line.source_line_id) ?? 0) + line.quantity);
  }
  return totals;
}

export async function listCertificates(options?: {
  storeId?: string;
  status?: CustomsCertificateStatus;
}): Promise<CustomsCertificateRow[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  const db = await getDb();
  let q = db.from("customs_certificates").select("*").in("store_id", storeIds);
  if (options?.storeId) q = q.eq("store_id", options.storeId);
  if (options?.status) q = q.eq("status", options.status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throwDbError(error, "listCertificates");
  return (data ?? []).map((row) => mapCertificate(row as Record<string, unknown>));
}

export async function getCertificate(id: string): Promise<CustomsCertificateRow | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customs_certificates")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getCertificate");
  return data ? mapCertificate(data as Record<string, unknown>) : null;
}

export async function insertCertificate(
  input: Omit<CustomsCertificateRow, "id" | "created_at" | "org_id" | "closed_at"> & {
    org_id?: string;
    closed_at?: string | null;
  }
): Promise<CustomsCertificateRow> {
  const db = await getDb();
  const orgId = input.org_id ?? (await getOrgId());
  const { data, error } = await db
    .from("customs_certificates")
    .insert({
      org_id: orgId,
      store_id: input.store_id,
      certificate_number: input.certificate_number,
      status: input.status,
      certificate_date: input.certificate_date,
      notes: input.notes,
      created_by: input.created_by,
      closed_at: input.closed_at ?? null,
    } as never)
    .select()
    .single();
  if (error || !data) throwDbError(error, "insertCertificate");
  return mapCertificate(data as Record<string, unknown>);
}

export async function updateCertificate(
  id: string,
  patch: Partial<
    Pick<
      CustomsCertificateRow,
      "certificate_number" | "status" | "certificate_date" | "notes" | "closed_at"
    >
  >
): Promise<CustomsCertificateRow | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customs_certificates")
    .update(patch as never)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateCertificate");
  return data ? mapCertificate(data as Record<string, unknown>) : null;
}

export async function listCertificateCosts(
  certificateIds: string[]
): Promise<CustomsCertificateCostRow[]> {
  if (certificateIds.length === 0) return [];
  const db = await getDb();
  const rows: CustomsCertificateCostRow[] = [];
  for (const chunk of chunkIds(certificateIds)) {
    const { data, error } = await db
      .from("customs_certificate_costs")
      .select("*")
      .in("certificate_id", chunk)
      .order("created_at", { ascending: true });
    if (error) throwDbError(error, "listCertificateCosts");
    for (const row of data ?? []) {
      rows.push(mapCost(row as Record<string, unknown>));
    }
  }
  return rows;
}

export async function getCertificateCost(
  id: string
): Promise<CustomsCertificateCostRow | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("customs_certificate_costs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDbError(error, "getCertificateCost");
  if (!data) return null;
  const cost = mapCost(data as Record<string, unknown>);
  const certificate = await getCertificate(cost.certificate_id);
  if (!certificate) return null;
  return cost;
}

export async function insertCertificateCost(
  input: Omit<CustomsCertificateCostRow, "id" | "created_at" | "posted_amount"> & {
    posted_amount?: number;
  }
): Promise<CustomsCertificateCostRow> {
  const db = await getDb();
  const { data, error } = await db
    .from("customs_certificate_costs")
    .insert({
      certificate_id: input.certificate_id,
      cost_type: input.cost_type,
      amount: input.amount,
      payee_supplier_id: input.payee_supplier_id,
      payment_method: input.payment_method,
      notes: input.notes,
      posted_amount: input.posted_amount ?? 0,
      created_by: input.created_by,
    } as never)
    .select()
    .single();
  if (error || !data) throwDbError(error, "insertCertificateCost");
  return mapCost(data as Record<string, unknown>);
}

export async function updateCertificateCost(
  id: string,
  patch: Partial<
    Pick<
      CustomsCertificateCostRow,
      "cost_type" | "amount" | "payee_supplier_id" | "payment_method" | "notes" | "posted_amount"
    >
  >
): Promise<CustomsCertificateCostRow | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("customs_certificate_costs")
    .update(patch as never)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateCertificateCost");
  return data ? mapCost(data as Record<string, unknown>) : null;
}

export async function deleteCertificateCost(id: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("customs_certificate_costs").delete().eq("id", id);
  if (error) throwDbError(error, "deleteCertificateCost");
}

export async function listReceivedInvoicesForContainers(
  containerIds: string[]
): Promise<{ id: string; container_id: string; extra_cost: number }[]> {
  if (containerIds.length === 0) return [];
  const db = await getDb();
  const rows: { id: string; container_id: string; extra_cost: number }[] = [];
  for (const chunk of chunkIds(containerIds)) {
    const { data, error } = await db
      .from("purchase_invoices")
      .select("id, container_id, extra_cost")
      .in("container_id", chunk)
      .eq("status", "received")
      .eq("document_kind", "purchase_invoice");
    if (error) throwDbError(error, "listReceivedInvoicesForContainers");
    for (const row of data ?? []) {
      if (!row.container_id) continue;
      rows.push({
        id: String(row.id),
        container_id: String(row.container_id),
        extra_cost: Number(row.extra_cost ?? 0),
      });
    }
  }
  return rows;
}
