import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getDb } from "@/lib/repositories/client";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { normalizeEgyptPhone, phoneSearchDigits } from "@/lib/phone";
import type { Customer, LoyaltyLedgerEntry, Order, OrderItem } from "@/lib/types";
import { z } from "zod";

const customerNameSchema = z.string().trim().min(2, "اسم العميل يجب أن يكون حرفين على الأقل").max(120);
const customerEmailSchema = z.string().trim().email("البريد الإلكتروني غير صالح").max(254);

function validateCustomerPhone(value: string): string {
  const phone = normalizeEgyptPhone(value);
  const digits = phoneSearchDigits(phone);
  if (!phone) throw new Error("اكتب رقم الهاتف");
  if (digits.length < 8 || digits.length > 15) throw new Error("رقم الهاتف غير صالح");
  if (phone === "+10000000000" || phone === "01000000000" || phone === "10000000000") {
    throw new Error("أدخل رقم هاتف حقيقي للعميل");
  }
  return phone;
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? "";
  return email ? customerEmailSchema.parse(email) : null;
}

export interface CustomerProfile extends Customer {
  loyaltyBalance: number;
  recentOrders: Order[];
  favoriteProducts: { productId: string; name: string; count: number }[];
  avgOrderValue: number;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const trimmed = search?.trim();
  if (!trimmed) return customerRepo.listCustomers();
  const normalized = normalizeEgyptPhone(trimmed);
  const digits = phoneSearchDigits(trimmed);
  // Prefer digit/phone-normalized query when the input looks like a phone.
  const query =
    digits.length >= 3 && digits.length >= trimmed.replace(/\s+/g, "").length * 0.5
      ? digits
      : trimmed;
  return customerRepo.listCustomers(query || normalized || trimmed);
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
      name: productMap.get(productId) ?? "صنف غير معروف",
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
  address?: string;
  tax_id?: string;
  userId: string;
}): Promise<Customer> {
  const name = customerNameSchema.parse(input.name);
  const phone = validateCustomerPhone(input.phone);
  const email = normalizeOptionalEmail(input.email);

  const digits = phoneSearchDigits(phone);
  const candidates = await customerRepo.listCustomers(digits.length >= 3 ? digits : phone);
  const existing = candidates.find((c) => {
    const existingDigits = phoneSearchDigits(c.phone);
    return c.phone === phone || (existingDigits.length >= 8 && existingDigits === digits);
  });
  if (existing) throw new Error("رقم الهاتف مسجل لعميل آخر");

  const customer = await customerRepo.createCustomer({
    name,
    phone,
    email,
    notes: input.notes?.trim().slice(0, 1000) ?? "",
    address: input.address?.trim().slice(0, 240) ?? "",
    tax_id: input.tax_id?.trim().slice(0, 40) ?? "",
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
    Pick<Customer, "name" | "phone" | "email" | "notes" | "credit_limit" | "payment_terms" | "address" | "tax_id">
  >,
  userId: string
): Promise<Customer | null> {
  const patch = { ...input };
  if (typeof patch.name === "string") {
    patch.name = customerNameSchema.parse(patch.name);
  }
  if (typeof patch.phone === "string") {
    patch.phone = validateCustomerPhone(patch.phone);
    const digits = phoneSearchDigits(patch.phone);
    const candidates = await customerRepo.listCustomers(digits);
    if (candidates.some((candidate) => candidate.id !== id && phoneSearchDigits(candidate.phone) === digits)) {
      throw new Error("رقم الهاتف مسجل لعميل آخر");
    }
  }
  if ("email" in patch) {
    patch.email = normalizeOptionalEmail(patch.email);
  }
  if (typeof patch.notes === "string") {
    patch.notes = patch.notes.trim().slice(0, 1000);
  }
  if (typeof patch.payment_terms === "string") {
    patch.payment_terms = patch.payment_terms.trim().slice(0, 250);
  }
  if (typeof patch.address === "string") {
    patch.address = patch.address.trim().slice(0, 240);
  }
  if (typeof patch.tax_id === "string") {
    patch.tax_id = patch.tax_id.trim().slice(0, 40);
  }
  if (patch.credit_limit != null) {
    const creditLimit = Number(patch.credit_limit);
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      throw new Error("حد الائتمان يجب أن يكون صفراً أو أكبر");
    }
    patch.credit_limit = creditLimit;
  }
  const customer = await customerRepo.updateCustomer(id, patch);
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
