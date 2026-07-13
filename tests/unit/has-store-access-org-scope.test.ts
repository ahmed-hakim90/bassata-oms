import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("has_store_access org scope migration", () => {
  it("requires stores.org_id = auth_org_id for privileged access", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260713210009_fix_has_store_access_org_scope.sql"
      ),
      "utf8"
    );

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.has_store_access");
    expect(sql).toContain("s.org_id = public.auth_org_id()");
    expect(sql).toContain("public.is_privileged_role()");
    expect(sql).toContain("SET search_path = public, extensions");
  });
});
