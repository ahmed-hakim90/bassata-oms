import { z } from "zod";

export const souqnaOrderItemSchema = z.object({
  external_product_id: z.string().min(1, "معرّف المنتج الخارجي مطلوب"),
  sku: z.string().min(1, "كود المنتج مطلوب"),
  name: z.string().min(1, "اسم المنتج مطلوب"),
  quantity: z.number().int("الكمية يجب أن تكون رقمًا صحيحًا").positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_price: z.number().min(0, "سعر الوحدة لا يمكن أن يكون سالبًا"),
  total: z.number().min(0, "الإجمالي لا يمكن أن يكون سالبًا"),
});

export const souqnaOrderSchema = z.object({
  souqna_order_id: z.string().min(1, "رقم طلب سوقنا مطلوب"),
  checkout_session_id: z.string().optional(),
  customer_name: z.string().min(2, "اسم العميل مطلوب"),
  customer_phone: z.string().min(6, "رقم العميل غير صالح"),
  fulfillment_type: z.string().min(1, "نوع التسليم مطلوب"),
  delivery_area: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_fee: z.number().min(0, "رسوم التوصيل لا يمكن أن تكون سالبة"),
  subtotal: z.number().min(0, "الإجمالي الفرعي لا يمكن أن يكون سالبًا"),
  total: z.number().min(0, "الإجمالي لا يمكن أن يكون سالبًا"),
  payment_method: z.string().min(1, "طريقة الدفع مطلوبة"),
  notes: z.string().optional(),
  items: z.array(souqnaOrderItemSchema).min(1, "يجب إضافة عنصر واحد على الأقل"),
});

export type SouqnaOrderInput = z.infer<typeof souqnaOrderSchema>;
