import { z } from "zod";

export const souqnaProductsQuerySchema = z.object({
  updated_after: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export type SouqnaProductsQuery = z.infer<typeof souqnaProductsQuerySchema>;
