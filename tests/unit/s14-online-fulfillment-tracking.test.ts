import { describe, expect, it } from "vitest";
import {
  defaultOnlineFulfillmentConfig,
  parseOnlineFulfillment,
  resolveOnlineFulfillmentFee,
  serializeOnlineFulfillment,
  validateOnlineFulfillmentInput,
} from "@/modules/online-menu/lib/online-fulfillment";
import {
  createOnlineOrderTrackingToken,
  verifyOnlineOrderTrackingToken,
} from "@/modules/online-orders/lib/online-order-tracking";
import { getOnlinePublicRateLimits } from "@/modules/online-menu/lib/online-public-rate-limit";

describe("online-fulfillment", () => {
  it("defaults to pickup-only when settings missing", () => {
    const parsed = parseOnlineFulfillment({});
    expect(parsed.pickupEnabled).toBe(true);
    expect(parsed.deliveryEnabled).toBe(false);
    expect(parsed.zones).toEqual([]);
  });

  it("resolves pickup fee as zero", () => {
    const resolved = resolveOnlineFulfillmentFee(
      { pickupEnabled: true, deliveryEnabled: true, zones: [{ id: "z1", name: "المعادي", fee: 25 }] },
      { fulfillmentType: "pickup" }
    );
    expect(resolved.deliveryFee).toBe(0);
    expect(resolved.fulfillmentType).toBe("pickup");
  });

  it("resolves delivery fee from zone — ignores client fee", () => {
    const resolved = resolveOnlineFulfillmentFee(
      {
        pickupEnabled: true,
        deliveryEnabled: true,
        zones: [{ id: "z1", name: "المعادي", fee: 25.5 }],
      },
      {
        fulfillmentType: "delivery",
        zoneId: "z1",
        deliveryAddress: "شارع ٩ مبنى ١٢",
      }
    );
    expect(resolved.deliveryFee).toBe(25.5);
    expect(resolved.deliveryArea).toBe("المعادي");
    expect(resolved.deliveryAddress).toContain("شارع");
  });

  it("rejects delivery without zone or short address", () => {
    const config = {
      pickupEnabled: true,
      deliveryEnabled: true,
      zones: [{ id: "z1", name: "المعادي", fee: 20 }],
    };
    expect(() =>
      resolveOnlineFulfillmentFee(config, {
        fulfillmentType: "delivery",
        zoneId: "missing",
        deliveryAddress: "عنوان كافٍ للتسليم",
      })
    ).toThrow(/منطقة/);
    expect(() =>
      resolveOnlineFulfillmentFee(config, {
        fulfillmentType: "delivery",
        zoneId: "z1",
        deliveryAddress: "قص",
      })
    ).toThrow(/عنوان/);
  });

  it("validates settings input and round-trips serialize", () => {
    const validated = validateOnlineFulfillmentInput({
      pickupEnabled: true,
      deliveryEnabled: true,
      zones: [{ id: "a1", name: "الزمالك", fee: 30 }],
    });
    expect(validated.zones).toHaveLength(1);
    const serialized = serializeOnlineFulfillment(validated);
    expect(parseOnlineFulfillment({ online_fulfillment: serialized }).zones[0]?.fee).toBe(30);
    expect(defaultOnlineFulfillmentConfig().pickupEnabled).toBe(true);
  });

  it("requires at least one zone when delivery enabled", () => {
    expect(() =>
      validateOnlineFulfillmentInput({
        pickupEnabled: false,
        deliveryEnabled: true,
        zones: [],
      })
    ).toThrow(/منطقة/);
  });
});

describe("online-order-tracking token", () => {
  const orderId = "550e8400-e29b-41d4-a716-446655440000";

  it("creates and verifies a valid token", () => {
    process.env.SweetFlow_COOKIE_SECRET = "s14-test-secret";
    const token = createOnlineOrderTrackingToken(orderId);
    expect(token.startsWith(`${orderId}.`)).toBe(true);
    expect(verifyOnlineOrderTrackingToken(token)).toBe(orderId);
  });

  it("rejects tampered or invalid tokens", () => {
    process.env.SweetFlow_COOKIE_SECRET = "s14-test-secret";
    const token = createOnlineOrderTrackingToken(orderId);
    expect(verifyOnlineOrderTrackingToken(`${orderId}.deadbeef`)).toBeNull();
    expect(verifyOnlineOrderTrackingToken("not-a-uuid.abc")).toBeNull();
    expect(verifyOnlineOrderTrackingToken(token.replace(/.$/, "x"))).toBeNull();
  });
});

describe("online-public-rate-limit config", () => {
  it("exposes stricter order_create than menu", () => {
    const limits = getOnlinePublicRateLimits();
    expect(limits.menu.max).toBeGreaterThan(limits.order_create.max);
    expect(limits.order_create.windowSeconds).toBe(60);
  });
});
