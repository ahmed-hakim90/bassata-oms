import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND_OG_CTA,
  isSafeHttpsImageUrl,
  parseBrandOg,
  resolveBrandOg,
  validateBrandOgInput,
} from "@/modules/online-menu/lib/brand-og";
import {
  DEFAULT_BRAND_TYPOGRAPHY,
  buildGoogleFontsCssUrl,
  parseBrandTypography,
  snapBrandFontWeight,
  validateBrandTypographyInput,
} from "@/modules/online-menu/lib/brand-typography";

describe("parseBrandTypography", () => {
  it("defaults when brand is missing", () => {
    expect(parseBrandTypography({})).toEqual(DEFAULT_BRAND_TYPOGRAPHY);
  });

  it("reads stored faces and snaps unavailable weights", () => {
    const parsed = parseBrandTypography({
      brand: {
        typography: {
          heading: { family: "Alexandria", weight: 600 },
          body: { family: "Tajawal", weight: 400 },
          button: { family: "Tajawal", weight: 500 },
          price: { family: "Cairo", weight: 700 },
        },
      },
    });
    expect(parsed.heading).toEqual({ family: "Alexandria", weight: 700 });
    expect(parsed.body).toEqual({ family: "Tajawal", weight: 400 });
    expect(parsed.button).toEqual({ family: "Tajawal", weight: 500 });
    expect(parsed.price).toEqual({ family: "Cairo", weight: 700 });
  });

  it("rejects unknown families on write", () => {
    expect(() =>
      validateBrandTypographyInput({
        heading: { family: "Comic Sans", weight: 700 },
        body: { family: "Cairo", weight: 400 },
        button: { family: "Cairo", weight: 600 },
        price: { family: "Cairo", weight: 700 },
      })
    ).toThrow("اختيار الخط غير صالح");
  });
});

describe("snapBrandFontWeight", () => {
  it("prefers the heavier neighbor on a tie", () => {
    expect(snapBrandFontWeight("Cairo", 500)).toBe(600);
  });
});

describe("buildGoogleFontsCssUrl", () => {
  it("requests only used families and weights", () => {
    const url = buildGoogleFontsCssUrl({
      heading: { family: "Cairo", weight: 700 },
      body: { family: "Cairo", weight: 400 },
      button: { family: "Cairo", weight: 600 },
      price: { family: "Cairo", weight: 700 },
    });
    expect(url).toContain("family=Cairo:wght@400;600;700");
    expect(url).toContain("https://fonts.googleapis.com/css2?");
  });
});

describe("parseBrandOg", () => {
  it("falls back to legacy description and cover", () => {
    const parsed = parseBrandOg({
      online_menu_description: "مزيج لا يقاوم من النوتيلا والموتزاريلا",
      online_menu_cover_url: "https://cdn.example.com/cover.jpg",
    });
    expect(parsed.template).toBe("brand-product-order");
    expect(parsed.description).toBe("مزيج لا يقاوم من النوتيلا والموتزاريلا");
    expect(parsed.cta).toBe(DEFAULT_BRAND_OG_CTA);
    expect(parsed.image).toBe("https://cdn.example.com/cover.jpg");
    expect(parsed.title).toBeNull();
  });

  it("resolves title from the business name when empty", () => {
    const resolved = resolveBrandOg({
      settings: {
        brand: {
          og: {
            description: "مزيج لا يقاوم من النوتيلا والموتزاريلا",
            cta: "اطلب أونلاين",
          },
        },
      },
      businessName: "نوتيلا وموتزاريلا",
    });
    expect(resolved.title).toBe("نوتيلا وموتزاريلا");
    expect(resolved.description).toBe("مزيج لا يقاوم من النوتيلا والموتزاريلا");
  });

  it("rejects non-https image URLs", () => {
    expect(isSafeHttpsImageUrl("http://cdn.example.com/a.jpg")).toBe(false);
    expect(isSafeHttpsImageUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(() =>
      validateBrandOgInput({ image: "javascript:alert(1)" })
    ).toThrow("رابط صورة المشاركة غير صالح");
  });
});
