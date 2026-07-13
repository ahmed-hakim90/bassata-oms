import { describe, expect, it } from "vitest";
import { StoreDeleteBlockedError } from "@/modules/system/services/users.service";

describe("StoreDeleteBlockedError", () => {
  it("lists operational blockers in Arabic", () => {
    const error = new StoreDeleteBlockedError(["طلبات بيع", "جلسات كاشير"]);
    expect(error.message).toContain("طلبات بيع");
    expect(error.message).toContain("جلسات كاشير");
    expect(error.message).toContain("فرع نشط");
  });
});
