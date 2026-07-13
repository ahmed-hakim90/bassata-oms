import { describe, expect, it } from "vitest";
import { UserDeleteBlockedError } from "@/modules/system/services/users.service";

describe("UserDeleteBlockedError", () => {
  it("lists operational blockers in Arabic", () => {
    const error = new UserDeleteBlockedError(["طلبات بيع", "جلسات كاشير"]);
    expect(error.message).toContain("طلبات بيع");
    expect(error.message).toContain("جلسات كاشير");
    expect(error.message).toContain("استخدم التعطيل");
  });
});
