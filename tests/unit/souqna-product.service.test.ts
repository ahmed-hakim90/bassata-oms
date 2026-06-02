import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  mapSouqnaAvailability,
  resolvePricing,
  isPublicUrl,
} from "@/modules/souqna/services/souqna-product.service";
import { normalizeSouqnaIntegrationSettings } from "@/modules/souqna/services/souqna-settings.service";

describe("resolvePricing", () => {
  it("returns sale price when below base price", () => {
    expect(resolvePricing(28, 25)).toEqual({ price: 28, sale_price: 25 });
  });

  it("returns null sale price when sale is missing or not lower", () => {
    expect(resolvePricing(28, null)).toEqual({ price: 28, sale_price: null });
    expect(resolvePricing(28, 30)).toEqual({ price: 28, sale_price: null });
  });
});

describe("mapSouqnaAvailability", () => {
  it("marks untracked products in stock", () => {
    expect(mapSouqnaAvailability(false, 0)).toBe("in_stock");
  });

  it("marks tracked zero-qty products out of stock", () => {
    expect(mapSouqnaAvailability(true, 0)).toBe("out_of_stock");
    expect(mapSouqnaAvailability(true, 3)).toBe("in_stock");
  });
});

describe("isPublicUrl", () => {
  it("accepts http(s) urls only", () => {
    expect(isPublicUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isPublicUrl("ftp://x")).toBe(false);
    expect(isPublicUrl(null)).toBe(false);
  });
});

describe("normalizeSouqnaIntegrationSettings", () => {
  it("applies defaults", () => {
    expect(normalizeSouqnaIntegrationSettings(null)).toMatchObject({
      enable_souqna_channel: false,
      allow_order_import: true,
      reserve_stock_on_online_order: false,
    });
  });
});

describe("souqna api key auth helpers", () => {
  it("bcrypt validates generated keys", async () => {
    const apiKey = "sq_live_test_key_123";
    const hash = bcrypt.hashSync(apiKey, 4);
    expect(await bcrypt.compare(apiKey, hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});
