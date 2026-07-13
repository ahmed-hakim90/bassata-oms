import { describe, expect, it } from "vitest";
import {
  evaluateOnlineOrderingAvailability,
  isWithinTimeWindows,
  parseOnlineOrderingHours,
  validateOnlineOrderingHoursInput,
  weekdayKeyFromJsDay,
} from "@/modules/online-menu/lib/online-ordering-hours";

describe("online-ordering-hours", () => {
  it("maps JS getDay to weekday keys", () => {
    expect(weekdayKeyFromJsDay(0)).toBe("sun");
    expect(weekdayKeyFromJsDay(1)).toBe("mon");
    expect(weekdayKeyFromJsDay(6)).toBe("sat");
  });

  it("supports normal and overnight windows", () => {
    expect(isWithinTimeWindows(12 * 60, [{ open: "10:00", close: "22:00" }])).toBe(true);
    expect(isWithinTimeWindows(9 * 60, [{ open: "10:00", close: "22:00" }])).toBe(false);
    expect(isWithinTimeWindows(23 * 60, [{ open: "22:00", close: "02:00" }])).toBe(true);
    expect(isWithinTimeWindows(1 * 60, [{ open: "22:00", close: "02:00" }])).toBe(true);
    expect(isWithinTimeWindows(3 * 60, [{ open: "22:00", close: "02:00" }])).toBe(false);
  });

  it("defaults to open when enforce is false", () => {
    const result = evaluateOnlineOrderingAvailability({
      settings: {
        online_menu_ordering_enabled: true,
        online_ordering_hours: { enforce: false, days: {} },
      },
      now: new Date("2026-07-13T12:00:00Z"),
    });
    expect(result.canOrder).toBe(true);
    expect(result.reason).toBe("open");
  });

  it("blocks when paused even inside hours", () => {
    const result = evaluateOnlineOrderingAvailability({
      settings: {
        online_menu_ordering_enabled: true,
        online_ordering_paused: true,
        online_ordering_hours: {
          enforce: true,
          timezone: "UTC",
          days: {
            mon: { windows: [{ open: "00:00", close: "23:59" }] },
          },
        },
      },
      now: new Date("2026-07-13T12:00:00Z"), // Monday
    });
    expect(result.canOrder).toBe(false);
    expect(result.reason).toBe("paused");
  });

  it("blocks outside enforced hours", () => {
    const result = evaluateOnlineOrderingAvailability({
      settings: {
        online_menu_ordering_enabled: true,
        online_ordering_hours: {
          enforce: true,
          timezone: "UTC",
          days: {
            mon: { windows: [{ open: "10:00", close: "12:00" }] },
          },
        },
      },
      now: new Date("2026-07-13T15:00:00Z"), // Monday 15:00 UTC
    });
    expect(result.canOrder).toBe(false);
    expect(result.reason).toBe("outside_hours");
  });

  it("treats missing enforced day as closed", () => {
    const result = evaluateOnlineOrderingAvailability({
      settings: {
        online_menu_ordering_enabled: true,
        online_ordering_hours: {
          enforce: true,
          timezone: "UTC",
          days: {
            sun: { windows: [{ open: "10:00", close: "22:00" }] },
          },
        },
      },
      now: new Date("2026-07-13T12:00:00Z"), // Monday
    });
    expect(result.canOrder).toBe(false);
    expect(result.reason).toBe("day_closed");
  });

  it("validates persist payload", () => {
    expect(() =>
      validateOnlineOrderingHoursInput({
        enforce: true,
        days: {},
      })
    ).toThrow(/جدول أيام/);

    const ok = validateOnlineOrderingHoursInput({
      enforce: true,
      timezone: "Africa/Cairo",
      days: {
        mon: { windows: [{ open: "09:00", close: "22:00" }] },
      },
    });
    expect(ok.enforce).toBe(true);
    expect(parseOnlineOrderingHours({ online_ordering_hours: ok }).days.mon).toEqual({
      windows: [{ open: "09:00", close: "22:00" }],
    });
  });
});
