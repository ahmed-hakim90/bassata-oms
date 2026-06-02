import { describe, expect, it } from "vitest";
import {
  computeSessionLifecycle,
  formatSessionDuration,
} from "@/modules/sessions/services/session-lifecycle.service";

const settings = {
  max_open_hours: 24,
  warn_after_hours: 20,
  block_sales_when_expired: true,
};

function sessionOpenedHoursAgo(hours: number) {
  return {
    opened_at: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
    status: "open" as const,
  };
}

describe("computeSessionLifecycle", () => {
  it("returns open when below warn threshold", () => {
    const result = computeSessionLifecycle(sessionOpenedHoursAgo(10), settings);
    expect(result.lifecycle).toBe("open");
    expect(result.blocksSales).toBe(false);
  });

  it("returns warning between warn and max hours", () => {
    const result = computeSessionLifecycle(sessionOpenedHoursAgo(22), settings);
    expect(result.lifecycle).toBe("warning");
    expect(result.blocksSales).toBe(false);
  });

  it("returns expired_locked at or above max hours", () => {
    const result = computeSessionLifecycle(sessionOpenedHoursAgo(24), settings);
    expect(result.lifecycle).toBe("expired_locked");
    expect(result.blocksSales).toBe(true);
  });

  it("does not block sales when block_sales_when_expired is false", () => {
    const result = computeSessionLifecycle(sessionOpenedHoursAgo(30), {
      ...settings,
      block_sales_when_expired: false,
    });
    expect(result.lifecycle).toBe("expired_locked");
    expect(result.blocksSales).toBe(false);
  });

  it("clamps warn threshold to max hours", () => {
    const at23Hours = computeSessionLifecycle(sessionOpenedHoursAgo(23), {
      max_open_hours: 24,
      warn_after_hours: 30,
      block_sales_when_expired: true,
    });
    expect(at23Hours.lifecycle).toBe("open");

    const at24Hours = computeSessionLifecycle(sessionOpenedHoursAgo(24), {
      max_open_hours: 24,
      warn_after_hours: 30,
      block_sales_when_expired: true,
    });
    expect(at24Hours.lifecycle).toBe("expired_locked");
  });

  it("returns open lifecycle for closed sessions", () => {
    const result = computeSessionLifecycle(
      { opened_at: sessionOpenedHoursAgo(48).opened_at, status: "closed" },
      settings
    );
    expect(result.lifecycle).toBe("open");
    expect(result.blocksSales).toBe(false);
  });
});

describe("formatSessionDuration", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatSessionDuration(0.5)).toBe("30m");
  });

  it("formats hour durations", () => {
    expect(formatSessionDuration(2.25)).toBe("2h 15m");
  });
});
