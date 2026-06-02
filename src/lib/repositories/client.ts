import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export function asJson(value: Record<string, unknown>): Json {
  return value as Json;
}

export async function getDb() {
  return createClient();
}

/** Typed RPC calls until generated types include all functions */
export async function callRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).rpc(fn, args);
}

export function throwDbError(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}
