import { describe, expect, it } from "vitest";
import {
  allowedOnlineOrderStatusTransitions,
  canCancelOnlineOrder,
  canTransitionOnlineOrderStatus,
  primaryNextOnlineOrderStatus,
} from "@/modules/online-orders/lib/online-order-status";

describe("online-order-status transitions", () => {
  it("allows forward fulfillment and cancel from pending", () => {
    expect(allowedOnlineOrderStatusTransitions("pending")).toEqual([
      "accepted",
      "preparing",
      "ready",
      "cancelled",
    ]);
    expect(canTransitionOnlineOrderStatus("pending", "ready")).toBe(true);
    expect(canTransitionOnlineOrderStatus("pending", "accepted")).toBe(true);
  });

  it("blocks backward and invoiced transitions", () => {
    expect(canTransitionOnlineOrderStatus("ready", "pending")).toBe(false);
    expect(canTransitionOnlineOrderStatus("preparing", "accepted")).toBe(false);
    expect(allowedOnlineOrderStatusTransitions("invoiced")).toEqual([]);
    expect(allowedOnlineOrderStatusTransitions("cancelled")).toEqual([]);
  });

  it("exposes primary next and cancel helpers", () => {
    expect(primaryNextOnlineOrderStatus("pending")).toBe("accepted");
    expect(primaryNextOnlineOrderStatus("accepted")).toBe("preparing");
    expect(primaryNextOnlineOrderStatus("preparing")).toBe("ready");
    expect(primaryNextOnlineOrderStatus("ready")).toBeNull();
    expect(canCancelOnlineOrder("ready")).toBe(true);
    expect(canCancelOnlineOrder("invoiced")).toBe(false);
  });
});
