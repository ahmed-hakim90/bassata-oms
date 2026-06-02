import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Supplier } from "@/lib/types";

export async function listSuppliers(): Promise<Supplier[]> {
  return purchaseRepo.listSuppliers();
}

export async function createSupplier(
  input: Omit<Supplier, "id" | "org_id">,
  userId: string
): Promise<Supplier> {
  const supplier = await purchaseRepo.createSupplier(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "supplier.created",
    entityType: "supplier",
    entityId: supplier.id,
  });
  return supplier;
}

export async function updateSupplier(
  id: string,
  patch: Partial<Supplier>,
  userId: string
): Promise<Supplier | null> {
  const supplier = await purchaseRepo.updateSupplier(id, patch);
  if (supplier) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: id,
    });
  }
  return supplier;
}

export async function deleteSupplier(id: string, userId: string): Promise<boolean> {
  const ok = await purchaseRepo.deleteSupplier(id);
  if (ok) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "supplier.deleted",
      entityType: "supplier",
      entityId: id,
    });
  }
  return ok;
}
