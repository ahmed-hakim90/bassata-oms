import { describe, expect, it } from "vitest";
import {
  buildPosPathForSlug,
  isReservedPosSlug,
  isSlugPosPath,
  posSlugFromPathname,
} from "@/lib/tenancy/pos-store-slug";

describe("pos store slug routing", () => {
  it("builds /{slug}/pos paths", () => {
    expect(buildPosPathForSlug("Nutalla")).toBe("/nutalla/pos");
    expect(buildPosPathForSlug("  cafe-1 ")).toBe("/cafe-1/pos");
  });

  it("rejects reserved slugs", () => {
    expect(isReservedPosSlug("pos")).toBe(true);
    expect(isReservedPosSlug("settings")).toBe(true);
    expect(isReservedPosSlug("nutalla")).toBe(false);
  });

  it("detects slug POS public paths", () => {
    expect(isSlugPosPath("/nutalla/pos")).toBe(true);
    expect(isSlugPosPath("/nutalla/pos/")).toBe(true);
    expect(isSlugPosPath("/pos")).toBe(false);
    expect(isSlugPosPath("/settings/pos")).toBe(false);
    expect(isSlugPosPath("/login/pos")).toBe(false);
  });

  it("extracts slug from pathname", () => {
    expect(posSlugFromPathname("/nutalla/pos")).toBe("nutalla");
    expect(posSlugFromPathname("/pos")).toBeNull();
  });
});
