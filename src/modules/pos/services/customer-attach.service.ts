import {
  createCustomer,
  searchCustomers,
} from "@/modules/customers/services/customer.service";
import type { Customer } from "@/lib/types";

export async function searchCustomersForPOS(query: string): Promise<Customer[]> {
  if (!query.trim()) return [];
  return searchCustomers(query);
}

export async function searchCustomersByPhone(phone: string): Promise<Customer[]> {
  return searchCustomers(phone);
}

export async function quickCreateCustomer(input: {
  name: string;
  phone: string;
  userId: string;
}): Promise<Customer> {
  return createCustomer({
    name: input.name,
    phone: input.phone,
    userId: input.userId,
  });
}
