import { describe, expect, it } from "vitest";
import {
  isReportScheduleDue,
  normalizeReportSchedule,
} from "@/modules/reports/lib/report-schedule";

describe("report schedule", () => {
  it("defaults when empty", () => {
    const s = normalizeReportSchedule(null);
    expect(s.enabled).toBe(false);
    expect(s.cadence).toBe("weekly");
    expect(s.reportKeys).toContain("sales");
  });

  it("daily is always due when enabled", () => {
    expect(
      isReportScheduleDue({
        enabled: true,
        cadence: "daily",
        dayOfWeek: 1,
        dayOfMonth: 1,
        reportKeys: ["sales"],
      })
    ).toBe(true);
  });

  it("weekly matches UTC weekday", () => {
    const monday = new Date("2026-08-03T12:00:00Z"); // Monday
    expect(
      isReportScheduleDue(
        {
          enabled: true,
          cadence: "weekly",
          dayOfWeek: 1,
          dayOfMonth: 1,
          reportKeys: ["sales"],
        },
        monday
      )
    ).toBe(true);
    expect(
      isReportScheduleDue(
        {
          enabled: true,
          cadence: "weekly",
          dayOfWeek: 2,
          dayOfMonth: 1,
          reportKeys: ["sales"],
        },
        monday
      )
    ).toBe(false);
  });
});
