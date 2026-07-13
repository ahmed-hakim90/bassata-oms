import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260713150000_pos_held_carts.sql"
);

describe("S10 pos_held_carts migration", () => {
  it("creates store+device scoped held carts with RLS and ownership checks", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.pos_held_carts");
    expect(sql).toContain("store_id");
    expect(sql).toContain("device_id");
    expect(sql).toContain("org_id");
    expect(sql).toContain("payload JSONB");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("check_pos_held_cart_device_store");
    expect(sql).toContain("has_store_access(store_id)");
  });
});
