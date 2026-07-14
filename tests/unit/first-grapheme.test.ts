import { describe, expect, it } from "vitest";
import { firstGrapheme } from "@/lib/first-grapheme";

describe("firstGrapheme", () => {
  it("returns first Arabic letter", () => {
    expect(firstGrapheme("كاتشب")).toBe("ك");
  });

  it("does not split emoji surrogate pairs", () => {
    expect(firstGrapheme("🍕 بيتزا")).toBe("🍕");
  });

  it("uses fallback for empty / whitespace", () => {
    expect(firstGrapheme("   ")).toBe("?");
    expect(firstGrapheme("", "·")).toBe("·");
  });

  it("trims leading spaces before reading", () => {
    expect(firstGrapheme("  تفاح")).toBe("ت");
  });
});
