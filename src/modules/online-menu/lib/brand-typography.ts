/**
 * Per-store brand typography in `stores.settings.brand.typography` (JSON only).
 *
 * Design tokens on the public menu shell — not per-component font-family.
 * Families are allowlisted so OG ImageResponse can load matching local TTFs.
 */

import { z } from "zod";

export const BRAND_FONT_FAMILIES = [
  "Cairo",
  "Tajawal",
  "Alexandria",
  "Noto Sans Arabic",
] as const;

export type BrandFontFamily = (typeof BRAND_FONT_FAMILIES)[number];

export const BRAND_FONT_WEIGHTS = [400, 500, 600, 700] as const;
export type BrandFontWeight = (typeof BRAND_FONT_WEIGHTS)[number];

export const BRAND_TYPOGRAPHY_ROLES = ["heading", "body", "button", "price"] as const;
export type BrandTypographyRole = (typeof BRAND_TYPOGRAPHY_ROLES)[number];

export type BrandFontFace = {
  family: BrandFontFamily;
  weight: BrandFontWeight;
};

export type BrandTypography = Record<BrandTypographyRole, BrandFontFace>;

export const BRAND_TYPOGRAPHY_ROLE_LABELS_AR: Record<BrandTypographyRole, string> = {
  heading: "العناوين",
  body: "النص",
  button: "الأزرار",
  price: "الأسعار",
};

export const BRAND_FONT_FAMILY_LABELS_AR: Record<BrandFontFamily, string> = {
  Cairo: "Cairo",
  Tajawal: "Tajawal",
  Alexandria: "Alexandria",
  "Noto Sans Arabic": "Noto Sans Arabic",
};

export const BRAND_FONT_WEIGHT_LABELS_AR: Record<BrandFontWeight, string> = {
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
};

/** Weights we vendor as TTF for OG + nearest-snap. */
export const BRAND_FONT_AVAILABLE_WEIGHTS: Record<BrandFontFamily, readonly BrandFontWeight[]> = {
  Cairo: [400, 600, 700],
  Tajawal: [400, 500, 700],
  Alexandria: [400, 700],
  "Noto Sans Arabic": [400, 700],
};

export const DEFAULT_BRAND_TYPOGRAPHY: BrandTypography = {
  heading: { family: "Cairo", weight: 700 },
  body: { family: "Cairo", weight: 400 },
  button: { family: "Cairo", weight: 600 },
  price: { family: "Cairo", weight: 700 },
};

const brandFontFamilySchema = z.enum(BRAND_FONT_FAMILIES);
const brandFontWeightSchema = z.union([
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
]);

const brandFontFaceSchema = z.object({
  family: brandFontFamilySchema,
  weight: brandFontWeightSchema,
});

export const brandTypographySchema = z.object({
  heading: brandFontFaceSchema,
  body: brandFontFaceSchema,
  button: brandFontFaceSchema,
  price: brandFontFaceSchema,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isBrandFontFamily(value: string): value is BrandFontFamily {
  return (BRAND_FONT_FAMILIES as readonly string[]).includes(value);
}

export function snapBrandFontWeight(
  family: BrandFontFamily,
  weight: number
): BrandFontWeight {
  const available = BRAND_FONT_AVAILABLE_WEIGHTS[family];
  let best: BrandFontWeight = available[0] ?? 400;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of available) {
    const delta = Math.abs(candidate - weight);
    const preferHeavier = delta === bestDelta && candidate > best;
    if (delta < bestDelta || preferHeavier) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

function parseFace(value: unknown, fallback: BrandFontFace): BrandFontFace {
  const row = asRecord(value);
  const family = isBrandFontFamily(String(row.family ?? ""))
    ? (row.family as BrandFontFamily)
    : fallback.family;
  const rawWeight = Number(row.weight);
  const weight = Number.isFinite(rawWeight)
    ? snapBrandFontWeight(family, rawWeight)
    : snapBrandFontWeight(family, fallback.weight);
  return { family, weight };
}

export function parseBrandTypography(settings: unknown): BrandTypography {
  const root = asRecord(settings);
  const brand = asRecord(root.brand);
  const raw = asRecord(brand.typography);
  return {
    heading: parseFace(raw.heading, DEFAULT_BRAND_TYPOGRAPHY.heading),
    body: parseFace(raw.body, DEFAULT_BRAND_TYPOGRAPHY.body),
    button: parseFace(raw.button, DEFAULT_BRAND_TYPOGRAPHY.button),
    price: parseFace(raw.price, DEFAULT_BRAND_TYPOGRAPHY.price),
  };
}

export function validateBrandTypographyInput(value: unknown): BrandTypography {
  const parsed = brandTypographySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("اختيار الخط غير صالح");
  }
  return {
    heading: {
      family: parsed.data.heading.family,
      weight: snapBrandFontWeight(parsed.data.heading.family, parsed.data.heading.weight),
    },
    body: {
      family: parsed.data.body.family,
      weight: snapBrandFontWeight(parsed.data.body.family, parsed.data.body.weight),
    },
    button: {
      family: parsed.data.button.family,
      weight: snapBrandFontWeight(parsed.data.button.family, parsed.data.button.weight),
    },
    price: {
      family: parsed.data.price.family,
      weight: snapBrandFontWeight(parsed.data.price.family, parsed.data.price.weight),
    },
  };
}

export function uniqueBrandFontFaces(typography: BrandTypography): BrandFontFace[] {
  const seen = new Set<string>();
  const faces: BrandFontFace[] = [];
  for (const role of BRAND_TYPOGRAPHY_ROLES) {
    const face = typography[role];
    const key = `${face.family}:${face.weight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    faces.push(face);
  }
  return faces;
}

function googleFamilyParam(family: BrandFontFamily): string {
  return family.replaceAll(" ", "+");
}

/** Google Fonts CSS2 URL for the families/weights in use. Empty if nothing to load. */
export function buildGoogleFontsCssUrl(typography: BrandTypography): string {
  const byFamily = new Map<BrandFontFamily, Set<BrandFontWeight>>();
  for (const face of uniqueBrandFontFaces(typography)) {
    const weights = byFamily.get(face.family) ?? new Set<BrandFontWeight>();
    weights.add(face.weight);
    byFamily.set(face.family, weights);
  }
  const params = [...byFamily.entries()]
    .map(([family, weights]) => {
      const list = [...weights].sort((a, b) => a - b).join(";");
      return `family=${googleFamilyParam(family)}:wght@${list}`;
    })
    .join("&");
  if (!params) return "";
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function brandTypographyCssVars(
  typography: BrandTypography
): Record<string, string> {
  return {
    "--brand-font-heading": `"${typography.heading.family}", sans-serif`,
    "--brand-font-body": `"${typography.body.family}", sans-serif`,
    "--brand-font-button": `"${typography.button.family}", sans-serif`,
    "--brand-font-price": `"${typography.price.family}", sans-serif`,
    "--font-weight-heading": String(typography.heading.weight),
    "--font-weight-body": String(typography.body.weight),
    "--font-weight-button": String(typography.button.weight),
    "--font-weight-price": String(typography.price.weight),
    "--font-heading": `"${typography.heading.family}", sans-serif`,
    "--font-sans": `"${typography.body.family}", sans-serif`,
  };
}
