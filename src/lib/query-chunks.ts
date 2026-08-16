/** Default chunk size for PostgREST `.in()` filters (URL / planner safety). */
export const SUPABASE_IN_CHUNK = 200;

export function chunkIds<T>(items: T[], size = SUPABASE_IN_CHUNK): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
