import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S06 cross-tenant isolation suite.
 * Org A must never read Org B products/orders/menu payloads via admin or scoped repos.
 */

const ORG_A = "org-a";
const ORG_B = "org-b";
const STORE_A = "store-a";
const STORE_B = "store-b";
const PRODUCT_A = "product-a";
const PRODUCT_B = "product-b";

type EqCall = { column: string; value: unknown };

function createChainableQuery(result: { data: unknown; error: null }) {
  const eqCalls: EqCall[] = [];
  const inCalls: { column: string; values: unknown }[] = [];
  const filterCalls: { column: string; op: string; value: unknown }[] = [];

  const builder: Record<string, unknown> = {
    eqCalls,
    inCalls,
    filterCalls,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push({ column, value });
      return builder;
    }),
    in: vi.fn((column: string, values: unknown) => {
      inCalls.push({ column, values });
      return builder;
    }),
    filter: vi.fn((column: string, op: string, value: unknown) => {
      filterCalls.push({ column, op, value });
      return builder;
    }),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  };

  // Allow awaiting the builder directly (e.g. .in() terminal for products).
  Object.assign(builder, {
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(result).then(resolve),
  });

  return builder;
}

describe("cross-tenant: public online menu", () => {
  const adminFrom = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    adminFrom.mockReset();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: adminFrom,
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }));
    vi.doMock("@/modules/online-menu/lib/online-public-rate-limit", () => ({
      assertOnlinePublicRateLimit: vi.fn(async () => undefined),
    }));
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
    }));
  });

  it("scopes catalog queries to the store org and never returns other-org products", async () => {
    const storeQuery = createChainableQuery({
      data: {
        id: STORE_A,
        org_id: ORG_A,
        name: "Cafe A",
        address: "A",
        phone: "1",
        is_active: true,
        settings: {
          online_menu_enabled: true,
          online_menu_slug: "cafe-a",
          online_menu_ordering_enabled: true,
        },
        timezone: "Africa/Cairo",
      },
      error: null,
    });
    const orgQuery = createChainableQuery({
      data: { id: ORG_A, name: "Org A", currency: "EGP", logo_url: null },
      error: null,
    });
    const categoriesQuery = createChainableQuery({
      data: [{ id: "cat-a", name: "Hot", sort_order: 1, color: "#000", icon: "coffee" }],
      error: null,
    });
    const productsQuery = createChainableQuery({
      data: [
        {
          id: PRODUCT_A,
          org_id: ORG_A,
          category_id: "cat-a",
          name: "Latte A",
          description: "",
          image_url: null,
          base_price: 40,
          sale_price: 40,
          is_popular: false,
          show_on_online_menu: true,
        },
        // Defense: even if a bad row leaked into the response, post-filter drops it.
        {
          id: PRODUCT_B,
          org_id: ORG_B,
          category_id: "cat-b",
          name: "Latte B",
          description: "",
          image_url: null,
          base_price: 99,
          sale_price: 99,
          is_popular: true,
          show_on_online_menu: true,
        },
      ],
      error: null,
    });
    const variantsQuery = createChainableQuery({ data: [], error: null });

    adminFrom.mockImplementation((table: string) => {
      if (table === "stores") return storeQuery;
      if (table === "organizations") return orgQuery;
      if (table === "categories") return categoriesQuery;
      if (table === "products") return productsQuery;
      if (table === "product_variants") return variantsQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const { getOnlineMenuBySlug } = await import(
      "@/modules/online-menu/services/online-menu.service"
    );
    const menu = await getOnlineMenuBySlug("cafe-a");

    expect(menu).not.toBeNull();
    expect(menu!.store.canOrder).toBe(true);
    expect(menu!.items.map((item) => item.id)).toEqual([PRODUCT_A]);
    expect(menu!.items.some((item) => item.id === PRODUCT_B)).toBe(false);

    expect(productsQuery.eqCalls).toEqual(
      expect.arrayContaining([
        { column: "org_id", value: ORG_A },
        { column: "is_active", value: true },
        { column: "show_on_online_menu", value: true },
      ])
    );
    expect(categoriesQuery.eqCalls).toEqual(
      expect.arrayContaining([{ column: "org_id", value: ORG_A }])
    );
    expect(orgQuery.eqCalls).toEqual(
      expect.arrayContaining([{ column: "id", value: ORG_A }])
    );
  });

  it("returns null for unlisted menu without token (no cross-tenant discovery)", async () => {
    const storeQuery = createChainableQuery({
      data: {
        id: STORE_A,
        org_id: ORG_A,
        name: "Hidden",
        address: "",
        phone: "",
        is_active: true,
        timezone: "Africa/Cairo",
        settings: {
          online_menu_enabled: true,
          online_menu_unlisted: true,
          online_menu_token: "secret-token",
          online_menu_slug: "hidden-a",
        },
      },
      error: null,
    });
    adminFrom.mockImplementation((table: string) => {
      if (table === "stores") return storeQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const { getOnlineMenuBySlug } = await import(
      "@/modules/online-menu/services/online-menu.service"
    );
    expect(await getOnlineMenuBySlug("hidden-a")).toBeNull();
    expect(await getOnlineMenuBySlug("hidden-a", { token: "wrong" })).toBeNull();
  });
});

describe("cross-tenant: public online order", () => {
  const adminFrom = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    adminFrom.mockReset();
    process.env.SweetFlow_COOKIE_SECRET = "test-cookie-secret";
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: adminFrom,
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }));
    vi.doMock("@/modules/online-menu/lib/online-public-rate-limit", () => ({
      assertOnlinePublicRateLimit: vi.fn(async () => undefined),
    }));
    vi.doMock("next/headers", () => ({
      headers: vi.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
    }));
  });

  it("rejects lines for products belonging to another org", async () => {
    const storeQuery = createChainableQuery({
      data: {
        id: STORE_A,
        org_id: ORG_A,
        name: "Cafe A",
        is_active: true,
        timezone: "Africa/Cairo",
        settings: {
          online_menu_enabled: true,
          online_menu_ordering_enabled: true,
        },
      },
      error: null,
    });
    const productsQuery = createChainableQuery({
      // Admin query filtered by org A — Org B product absent from result.
      data: [],
      error: null,
    });
    const variantsQuery = createChainableQuery({ data: [], error: null });

    adminFrom.mockImplementation((table: string) => {
      if (table === "stores") return storeQuery;
      if (table === "products") return productsQuery;
      if (table === "product_variants") return variantsQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const { submitPublicOnlineOrder } = await import(
      "@/modules/online-orders/services/online-order.service"
    );

    await expect(
      submitPublicOnlineOrder({
        slug: "cafe-a",
        customerName: "Guest",
        fulfillmentType: "pickup",
        lines: [{ productId: PRODUCT_B, quantity: 1 }],
      })
    ).rejects.toThrow(/غير متاحة/);

    expect(productsQuery.eqCalls).toEqual(
      expect.arrayContaining([{ column: "org_id", value: ORG_A }])
    );
  });
});

describe("cross-tenant: authenticated product / order repos", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("listProducts always filters by session org_id", async () => {
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({
      eq,
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({ from: vi.fn(() => ({ select })) })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
    }));
    vi.doMock("@/lib/repositories/organization.repository", () => ({
      getOrgId: vi.fn(async () => ORG_A),
    }));

    const { listProducts } = await import("@/lib/repositories/catalog.repository");
    await listProducts();

    expect(eq).toHaveBeenCalledWith("org_id", ORG_A);
  });

  it("getProduct returns null when id is outside session org", async () => {
    const inIds = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqOrg = vi.fn().mockReturnValue({ in: inIds });
    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({ eq: eqOrg }),
        })),
      })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
    }));
    vi.doMock("@/lib/repositories/organization.repository", () => ({
      getOrgId: vi.fn(async () => ORG_A),
    }));

    const { getProduct } = await import("@/lib/repositories/catalog.repository");
    const product = await getProduct(PRODUCT_B);

    expect(product).toBeNull();
    expect(eqOrg).toHaveBeenCalledWith("org_id", ORG_A);
    expect(inIds).toHaveBeenCalledWith("id", [PRODUCT_B]);
  });

  it("listSessions scopes to org stores and ignores foreign store ids", async () => {
    const inStoreIds = vi.fn().mockReturnThis();
    const eqStore = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnValue({
      in: inStoreIds,
      eq: eqStore,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });
    inStoreIds.mockReturnValue({
      eq: eqStore,
      order: vi.fn().mockReturnValue({
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });
    eqStore.mockReturnValue({
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });

    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            in: inStoreIds,
            order,
          }),
        })),
      })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
    }));
    vi.doMock("@/lib/repositories/store.repository", () => ({
      listStores: vi.fn(async () => [{ id: STORE_A, org_id: ORG_A }]),
    }));

    const { listSessions } = await import("@/lib/repositories/session.repository");
    const sessions = await listSessions(STORE_B);

    expect(sessions).toEqual([]);
    expect(inStoreIds).not.toHaveBeenCalled();
  });

  it("listSessions without storeId still constrains to org store ids", async () => {
    const inStoreIds = vi.fn().mockReturnThis();
    const orderFn = vi.fn().mockReturnValue({
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });
    inStoreIds.mockReturnValue({
      order: orderFn,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });

    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            in: inStoreIds,
          }),
        })),
      })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
    }));
    vi.doMock("@/lib/repositories/store.repository", () => ({
      listStores: vi.fn(async () => [{ id: STORE_A, org_id: ORG_A }]),
    }));

    const { listSessions } = await import("@/lib/repositories/session.repository");
    await listSessions();

    expect(inStoreIds).toHaveBeenCalledWith("store_id", [STORE_A]);
  });

  it("listOrders scopes to org stores and ignores foreign store ids", async () => {
    const inStoreIds = vi.fn().mockReturnThis();
    const eqStore = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnValue({
      in: inStoreIds,
      eq: eqStore,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });
    // Make chain awaitable after filters
    inStoreIds.mockReturnValue({
      eq: eqStore,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });
    eqStore.mockReturnValue({
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    });

    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({ order }),
        })),
      })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
      callRpc: vi.fn(),
    }));
    vi.doMock("@/lib/repositories/store.repository", () => ({
      listStores: vi.fn(async () => [{ id: STORE_A, org_id: ORG_A }]),
    }));

    const { listOrders } = await import("@/lib/repositories/order.repository");
    await listOrders(STORE_B);

    expect(inStoreIds).toHaveBeenCalledWith("store_id", [STORE_A]);
    expect(eqStore).toHaveBeenCalledWith("store_id", STORE_B);
  });

  it("listOnlineOrders returns empty when requested store is outside org access", async () => {
    vi.doMock("@/lib/repositories/client", () => ({
      getDb: vi.fn(async () => ({
        from: vi.fn(() => {
          throw new Error("should not query when store not in access list");
        }),
      })),
      throwDbError: (error: unknown, ctx: string) => {
        throw new Error(`${ctx}: ${String(error)}`);
      },
    }));
    vi.doMock("@/lib/repositories/store.repository", () => ({
      listStores: vi.fn(async () => [{ id: STORE_A, org_id: ORG_A }]),
    }));

    const { listOnlineOrders } = await import(
      "@/lib/repositories/online-order.repository"
    );
    const orders = await listOnlineOrders(STORE_B);
    expect(orders).toEqual([]);
  });
});
