/**
 * Shared helpers for verify-*.mjs scripts (remote Supabase).
 */

export async function getDefaultWarehouseId(supabase, storeId) {
  const { data, error } = await supabase
    .from("warehouses")
    .select("id")
    .eq("store_id", storeId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`No default warehouse for store ${storeId}`);
  }
  return data.id;
}
