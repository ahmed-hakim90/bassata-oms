import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getDb } from "@/lib/repositories/client";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Customer, LoyaltyLedgerEntry, Order, OrderItem } from "@/lib/types";

export interface CustomerProfile extends Customer {
  loyaltyBalance: number;
  recentOrders: Order[];
  favoriteProducts: { productId: string; name: string; count: number }[];
  avgOrderValue: number;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  return customerRepo.listCustomers(search);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return customerRepo.getCustomer(id);
}

export async function getCustomerProfile(id: string): Promise<CustomerProfile | null> {
  const customer = await customerRepo.getCustomer(id);
  if (!customer) return null;

  const loyaltyBalance = await customerRepo.getLoyaltyBalance(id);
  const recentOrders = (await orderRepo.listOrders())
    .filter((o) => o.customer_id === id && o.status === "completed")
    .slice(0, 10);

  const orderIds = recentOrders.map((o) => o.id);
  const db = await getDb();
  const { data: items } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const item of (items ?? []) as OrderItem[]) {
    counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + item.quantity);
  }

  const favoriteProducts = [...counts.entries()]
    .map(([productId, count]) => ({
      productId,
      name: productMap.get(productId) ?? "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    ...customer,
    loyaltyBalance,
    recentOrders,
    favoriteProducts,
    avgOrderValue: customer.visit_count > 0 ? customer.total_spent / customer.visit_count : 0,
  };
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string;
  userId: string;
}): Promise<Customer> {
  const existing = (await customerRepo.listCustomers(input.phone)).find(
    (c) => c.phone === input.phone
  );
  if (existing) throw new Error("Phone number already registered");

  const customer = await customerRepo.createCustomer({
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    notes: input.notes ?? "",
    credit_limit: 0,
    payment_terms: "",
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId: input.userId,
    action: "customer.created",
    entityType: "customer",
    entityId: customer.id,
  });
  return customer;
}

export async function updateCustomer(
  id: string,
  input: Partial<
    Pick<Customer, "name" | "phone" | "email" | "notes" | "credit_limit" | "payment_terms">
  >,
  userId: string
): Promise<Customer | null> {
  const customer = await customerRepo.updateCustomer(id, input);
  if (customer) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "customer.updated",
      entityType: "customer",
      entityId: id,
    });
  }
  return customer;
}

export async function deleteCustomer(id: string, userId: string): Promise<boolean> {
  const ok = await customerRepo.deleteCustomer(id);
  if (ok) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: id,
    });
  }
  return ok;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  return (await listCustomers(query)).slice(0, 10);
}

export async function getCustomerLedger(customerId: string): Promise<LoyaltyLedgerEntry[]> {
  return customerRepo.listLoyaltyLedger(customerId);
}
