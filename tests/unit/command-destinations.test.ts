import { describe, expect, it } from "vitest";
import { getCommandPaletteGroups } from "@/lib/auth/command-destinations";
import type { PermissionKey } from "@/lib/constants";
import { allReportHubLinks } from "@/modules/reports/lib/report-hub-links";
import { PLATFORM_NAV_GROUPS } from "@/modules/platform/lib/platform-nav";

function hrefs(
  role: "owner" | "manager" | "cashier" | "inventory",
  flags?: Parameters<typeof getCommandPaletteGroups>[2],
  permissions: PermissionKey[] = [],
  options?: Parameters<typeof getCommandPaletteGroups>[3]
) {
  return getCommandPaletteGroups(role, new Set(permissions), flags, options).flatMap((group) =>
    group.items.map((item) => item.href)
  );
}

describe("command palette destinations", () => {
  it("includes every reports hub card for an owner with credit sales", () => {
    const items = hrefs("owner", { credit_sales: true });
    for (const link of allReportHubLinks()) {
      expect(items).toContain(link.href);
    }
  });

  it("includes sidebar pages plus extras for an owner", () => {
    const items = hrefs("owner", { credit_sales: true, purchase_imports: true });
    expect(items).toContain("/");
    expect(items).toContain("/reports");
    expect(items).toContain("/inventory/movements");
    expect(items).toContain("/inventory/purchases/price-list");
    expect(items).toContain("/inventory/containers");
    expect(items).toContain("/inventory/customs-certificates");
    expect(items).toContain("/account");
    expect(items).toContain("/devices");
    expect(items).toContain("/settings?tab=branches");
    expect(items).toContain("/settings?tab=print");
  });

  it("hides import destinations when purchase_imports is off", () => {
    const items = hrefs("owner", { purchase_imports: false, purchases: true });
    expect(items).not.toContain("/inventory/containers");
    expect(items).not.toContain("/inventory/customs-certificates");
  });

  it("does not duplicate sidebar hrefs", () => {
    const items = hrefs("owner");
    expect(items.filter((href) => href === "/reports/sales")).toHaveLength(1);
    expect(items.filter((href) => href === "/settings")).toHaveLength(1);
    expect(items.filter((href) => href === "/labels")).toHaveLength(1);
  });

  it("hides customer aging when credit sales are off", () => {
    const items = hrefs("owner", { credit_sales: false });
    expect(items).not.toContain("/reports/aging?side=customers");
    expect(items).toContain("/reports/aging?side=suppliers");
  });

  it("hides reports extras when the reports flag is off", () => {
    const items = hrefs("owner", { reports: false });
    expect(items.filter((href) => href.startsWith("/reports"))).toEqual([]);
  });

  it("hides the purchase price list when purchases are off", () => {
    const items = hrefs("owner", { purchases: false });
    expect(items).not.toContain("/inventory/purchases/price-list");
    expect(items).not.toContain("/inventory/purchases");
  });

  it("hides the new sales invoice shortcut unless wholesale is enabled", () => {
    expect(hrefs("owner")).not.toContain("/sales-invoices?create=1");
    expect(hrefs("owner", undefined, [], { enableWholesaleSales: true })).toContain(
      "/sales-invoices?create=1"
    );
  });

  it("hides profit reports for a manager without profit permission", () => {
    const items = hrefs("manager", { credit_sales: true }, ["reports_view"]);
    expect(items).toContain("/reports/heatmap");
    expect(items).not.toContain("/reports/profit");
    expect(items).not.toContain("/reports/margins");
    expect(items).not.toContain("/reports/pnl");
  });

  it("does not expose settings tabs or reports to a cashier", () => {
    const items = hrefs("cashier");
    expect(items).toContain("/pos");
    expect(items).toContain("/account");
    expect(items).not.toContain("/reports/sales/product");
    expect(items).not.toContain("/settings?tab=users");
    expect(items).not.toContain("/inventory/movements");
    expect(items).not.toContain("/inventory/purchases/price-list");
    expect(items).not.toContain("/devices");
  });

  it("covers every visible platform admin destination", () => {
    const hrefsOnPlatform = PLATFORM_NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => item.href)
    );
    expect(hrefsOnPlatform).toContain("/platform");
    expect(hrefsOnPlatform).toContain("/platform/sessions");
    expect(hrefsOnPlatform).toContain("/platform/menu-themes");
    expect(hrefsOnPlatform).not.toContain("/platform/devices");
  });
});
