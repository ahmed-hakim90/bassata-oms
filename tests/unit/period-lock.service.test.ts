import { describe, expect, it } from "vitest";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

describe("assertPeriodOpen", () => {
  it("allows operations after monthly closing removal", async () => {
    await expect(assertPeriodOpen("store-1")).resolves.toBeUndefined();
  });
});
