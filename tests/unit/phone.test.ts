import { describe, expect, it } from "vitest";
import { normalizeEgyptPhone, phoneSearchDigits } from "@/lib/phone";

describe("normalizeEgyptPhone", () => {
  it("normalizes +20 and 20 prefixes to local 01 form", () => {
    expect(normalizeEgyptPhone("+201012345678")).toBe("01012345678");
    expect(normalizeEgyptPhone("201012345678")).toBe("01012345678");
    expect(normalizeEgyptPhone("01012345678")).toBe("01012345678");
    expect(normalizeEgyptPhone("1012345678")).toBe("01012345678");
  });

  it("exposes digits for search", () => {
    expect(phoneSearchDigits("+20 101-234-5678")).toBe("01012345678");
  });
});
