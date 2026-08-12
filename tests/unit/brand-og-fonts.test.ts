import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_FONT_AVAILABLE_WEIGHTS,
  type BrandFontFamily,
  type BrandFontWeight,
} from "@/modules/online-menu/lib/brand-typography";

const FILE_BY_FACE: Record<BrandFontFamily, Partial<Record<BrandFontWeight, string>>> = {
  Cairo: { 400: "Cairo-Regular.ttf", 600: "Cairo-SemiBold.ttf", 700: "Cairo-Bold.ttf" },
  Tajawal: { 400: "Tajawal-Regular.ttf", 500: "Tajawal-Medium.ttf", 700: "Tajawal-Bold.ttf" },
  Alexandria: { 400: "Alexandria-Regular.ttf", 700: "Alexandria-Bold.ttf" },
  "Noto Sans Arabic": {
    400: "NotoSansArabic-Regular.ttf",
    700: "NotoSansArabic-Bold.ttf",
  },
};

describe("vendored OG font files", () => {
  it("includes a TTF for every allowlisted family/weight", () => {
    for (const [family, weights] of Object.entries(BRAND_FONT_AVAILABLE_WEIGHTS) as [
      BrandFontFamily,
      readonly BrandFontWeight[],
    ][]) {
      for (const weight of weights) {
        const fileName = FILE_BY_FACE[family][weight];
        expect(fileName, `${family} ${weight}`).toBeTruthy();
        const filePath = path.join(process.cwd(), "public/fonts", fileName as string);
        expect(existsSync(filePath), filePath).toBe(true);
      }
    }
  });
});
