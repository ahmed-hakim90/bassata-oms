/**
 * Per-store Open Graph config in `stores.settings.brand.og` (JSON only).
 *
 * Templates generate share cards from Brand + Product + Ordering — not menu-only copy.
 */

import { z } from "zod";
import { parseBrandTypography, type BrandTypography } from "./brand-typography";

export const BRAND_OG_TEMPLATES = ["brand-product-order"] as const;
export type BrandOgTemplate = (typeof BRAND_OG_TEMPLATES)[number];

export const DEFAULT_BRAND_OG_CTA = "اطلب أونلاين";
export const DEFAULT_BRAND_OG_TEMPLATE: BrandOgTemplate = "brand-product-order";

export const BRAND_OG_TEMPLATE_LABELS_AR: Record<BrandOgTemplate, string> = {
  "brand-product-order": "براند + منتج + طلب",
};

export type BrandOgConfig = {
  template: BrandOgTemplate;
  title: string | null;
  description: string | null;
  cta: string;
  image: string | null;
};

export type ResolvedBrandOg = {
  template: BrandOgTemplate;
  title: string;
  description: string;
  cta: string;
  image: string | null;
  typography: BrandTypography;
};

const OG_TEXT_MAX = 120;
const OG_CTA_MAX = 40;
const OG_URL_MAX = 2048;

const brandOgTemplateSchema = z.enum(BRAND_OG_TEMPLATES);

export const brandOgConfigSchema = z.object({
  template: brandOgTemplateSchema.default(DEFAULT_BRAND_OG_TEMPLATE),
  title: z.string().max(OG_TEXT_MAX).nullable().optional(),
  description: z.string().max(OG_TEXT_MAX).nullable().optional(),
  cta: z.string().max(OG_CTA_MAX).optional(),
  image: z.string().max(OG_URL_MAX).nullable().optional(),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOrNull(value: unknown, max = OG_TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export function isBrandOgTemplate(value: string): value is BrandOgTemplate {
  return (BRAND_OG_TEMPLATES as readonly string[]).includes(value);
}

export function isSafeHttpsImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
      return false;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseBrandOg(settings: unknown): BrandOgConfig {
  const root = asRecord(settings);
  const brand = asRecord(root.brand);
  const raw = asRecord(brand.og);
  const templateRaw = typeof raw.template === "string" ? raw.template : "";
  const imageRaw = textOrNull(raw.image, OG_URL_MAX);
  const legacyDescription = textOrNull(root.online_menu_description);
  const legacyCover = textOrNull(root.online_menu_cover_url, OG_URL_MAX);

  return {
    template: isBrandOgTemplate(templateRaw) ? templateRaw : DEFAULT_BRAND_OG_TEMPLATE,
    title: textOrNull(raw.title),
    description: textOrNull(raw.description) ?? legacyDescription,
    cta: textOrNull(raw.cta, OG_CTA_MAX) ?? DEFAULT_BRAND_OG_CTA,
    image:
      imageRaw && isSafeHttpsImageUrl(imageRaw)
        ? imageRaw
        : legacyCover && isSafeHttpsImageUrl(legacyCover)
          ? legacyCover
          : null,
  };
}

export function validateBrandOgInput(value: unknown): BrandOgConfig {
  const parsed = brandOgConfigSchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw new Error("بيانات المشاركة غير صالحة");
  }
  const title = textOrNull(parsed.data.title);
  const description = textOrNull(parsed.data.description);
  const cta = textOrNull(parsed.data.cta, OG_CTA_MAX) ?? DEFAULT_BRAND_OG_CTA;
  const imageRaw = textOrNull(parsed.data.image, OG_URL_MAX);
  if (imageRaw && !isSafeHttpsImageUrl(imageRaw)) {
    throw new Error("رابط صورة المشاركة غير صالح");
  }
  return {
    template: parsed.data.template ?? DEFAULT_BRAND_OG_TEMPLATE,
    title,
    description,
    cta,
    image: imageRaw,
  };
}

export function resolveBrandOg(input: {
  settings: unknown;
  businessName: string;
  fallbackDescription?: string | null;
}): ResolvedBrandOg {
  const og = parseBrandOg(input.settings);
  const typography = parseBrandTypography(input.settings);
  const businessName = input.businessName.trim() || DEFAULT_BRAND_OG_CTA;
  return {
    template: og.template,
    title: og.title?.trim() || businessName,
    description: og.description?.trim() || input.fallbackDescription?.trim() || "",
    cta: og.cta.trim() || DEFAULT_BRAND_OG_CTA,
    image: og.image,
    typography,
  };
}

export function mergeStoreBrandSettings(
  existing: Record<string, unknown>,
  input: { typography?: BrandTypography; og?: BrandOgConfig }
): Record<string, unknown> {
  const currentBrand = asRecord(existing.brand);
  const nextBrand: Record<string, unknown> = { ...currentBrand };
  if (input.typography) nextBrand.typography = input.typography;
  if (input.og) nextBrand.og = input.og;
  const next: Record<string, unknown> = { ...existing, brand: nextBrand };
  if (input.og) {
    if (input.og.description) next.online_menu_description = input.og.description;
    if (input.og.image) next.online_menu_cover_url = input.og.image;
  }
  return next;
}
