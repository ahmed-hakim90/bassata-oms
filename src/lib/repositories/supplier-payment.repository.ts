import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapSupplierPayment } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { listStores } from "@/lib/repositories/store.repository";
import type { PaymentMethod } from "@/lib/types";
import type { SupplierPayment } from "@/lib/types";

export async function insertSupplierPayment(input: {
  storeId: string;
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt: string;
  createdBy: string;
}): Promise<SupplierPayment> {
  const storeIds = (await listStores()).map((store) => store.id);
  if (!storeIds.includes(input.storeId)) {
    throw new Error("Store access denied");
  }

  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      supplier_id: input.supplierId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      reference: input.reference ?? "",
      notes: input.notes ?? "",
      paid_at: input.paidAt,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "insertSupplierPayment");
  return mapSupplierPayment(data);
}

export async function getSupplierPayment(id: string): Promise<SupplierPayment | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getSupplierPayment");
  return data ? mapSupplierPayment(data) : null;
}

export async function listPaymentsForStore(
  storeId: string,
  options?: { supplierId?: string }
): Promise<SupplierPayment[]> {
  const storeIds = (await listStores()).map((store) => store.id);
  if (!storeIds.includes(storeId)) return [];

  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("supplier_payments")
    .select("*")
    .eq("org_id", orgId)
    .eq("store_id", storeId);
  if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);
  const { data, error } = await q.order("paid_at", { ascending: false });
  if (error) throwDbError(error, "listPaymentsForStore");
  return (data ?? []).map(mapSupplierPayment);
}

export async function voidSupplierPayment(id: string): Promise<SupplierPayment | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .is("voided_at", null)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "voidSupplierPayment");
  return data ? mapSupplierPayment(data) : null;
}
