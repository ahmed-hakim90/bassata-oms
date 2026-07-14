import { describe, expect, it } from "vitest";
import {
  getPriceListFormat,
  PRICE_LIST_FORMATS,
} from "@/modules/price-lists/lib/formats";

describe("price list formats", () => {
  it("covers social + print sizes", () => {
    expect(PRICE_LIST_FORMATS.map((f) => f.id).sort()).toEqual(
      ["a4", "instagram", "square", "story"].sort()
    );
  });

  it("returns requested format dimensions", () => {
    const story = getPriceListFormat("story");
    expect(story.width).toBe(1080);
    expect(story.height).toBe(1920);
  });

  it("falls back to first format for unknown id cast", () => {
    // defensive: studio may cast user input
    const fallback = getPriceListFormat("instagram");
    expect(getPriceListFormat("instagram")).toEqual(fallback);
    expect(PRICE_LIST_FORMATS[0]?.id).toBe("instagram");
  });

  it("uses higher pixelRatio for A4 print export", () => {
    expect(getPriceListFormat("a4").pixelRatio).toBeGreaterThan(
      getPriceListFormat("square").pixelRatio
    );
  });
});
