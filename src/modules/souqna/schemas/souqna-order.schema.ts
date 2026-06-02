import { z } from "zod";

export const souqnaOrderItemSchema = z.object({
  external_product_id: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  total: z.number().min(0),
});

export const souqnaOrderSchema = z.object({
  souqna_order_id: z.string().min(1),
  checkout_session_id: z.string().optional(),
  customer_name: z.string().min(2),
  customer_phone: z.string().min(6),
  fulfillment_type: z.string().min(1),
  delivery_area: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_fee: z.number().min(0),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  payment_method: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(souqnaOrderItemSchema).min(1),
});

export type SouqnaOrderInput = z.infer<typeof souqnaOrderSchema>;
