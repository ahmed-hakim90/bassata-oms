import { describe, expect, it } from "vitest";
import { filterNavByAccess } from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey } from "@/lib/constants";

function hrefs(
  role: "owner" | "manager" | "cashier" | "inventory",
  flags?: Partial<Record<FeatureFlag, boolean>>,
  permissions: PermissionKey[] = []
) {
  return filterNavByAccess(role, new Set(permissions), flags).flatMap((g) =>
    g.items.map((i) => i.href)
  );
}

describe("S08 nav feature gates", () => {
  it("hides purchases/suppliers when purchases flag is false", () => {
    const items = hrefs("owner", { purchases: false });
    expect(items).not.toContain("/inventory/purchases");
    expect(items).not.toContain("/inventory/suppliers");
  });

  it("hides inventory modules when their flags are false", () => {
    const items = hrefs("owner", {
      transfers: false,
      waste: false,
      stock_count: false,
    });
    expect(items).not.toContain("/inventory/transfers");
    expect(items).not.toContain("/inventory/waste");
    expect(items).not.toContain("/inventory/stock-count");
  });

  it("hides loyalty and expenses when flags are false", () => {
    const items = hrefs("owner", { loyalty: false, session_expenses: false });
    expect(items).not.toContain("/customers/loyalty");
    expect(items).not.toContain("/expenses");
  });

  it("hides all report routes when reports flag is false", () => {
    const items = hrefs("owner", { reports: false });
    expect(items.filter((h) => h.startsWith("/reports"))).toEqual([]);
  });

  it("keeps labels visible when barcode_scanner is false (permission-gated)", () => {
    const items = hrefs("owner", { barcode_scanner: false });
    expect(items).toContain("/labels");
  });

  it("keeps online-orders visible (store-settings, not feature_flags)", () => {
    const items = hrefs("owner", {});
    expect(items).toContain("/online-orders");
  });
});
