import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  snapBrandFontWeight,
  uniqueBrandFontFaces,
  type BrandFontFamily,
  type BrandFontWeight,
  type BrandTypography,
} from "@/modules/online-menu/lib/brand-typography";

export const ARABIC_OG_FONT_FAMILY = "Noto Sans Arabic";

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: BrandFontWeight;
  style: "normal";
};

const FONT_FILE_BY_FACE: Record<BrandFontFamily, Partial<Record<BrandFontWeight, string>>> = {
  Cairo: {
    400: "Cairo-Regular.ttf",
    600: "Cairo-SemiBold.ttf",
    700: "Cairo-Bold.ttf",
  },
  Tajawal: {
    400: "Tajawal-Regular.ttf",
    500: "Tajawal-Medium.ttf",
    700: "Tajawal-Bold.ttf",
  },
  Alexandria: {
    400: "Alexandria-Regular.ttf",
    700: "Alexandria-Bold.ttf",
  },
  "Noto Sans Arabic": {
    400: "NotoSansArabic-Regular.ttf",
    700: "NotoSansArabic-Bold.ttf",
  },
};

const fileCache = new Map<string, Buffer>();

function copyBuffer(source: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes.buffer;
}

async function readFontFile(fileName: string): Promise<Buffer> {
  const cached = fileCache.get(fileName);
  if (cached) return cached;
  const fontPath = path.join(process.cwd(), "public/fonts", fileName);
  const bytes = await readFile(fontPath);
  fileCache.set(fileName, bytes);
  return bytes;
}

function fileForFace(family: BrandFontFamily, weight: BrandFontWeight): string | null {
  const snapped = snapBrandFontWeight(family, weight);
  return FONT_FILE_BY_FACE[family][snapped] ?? null;
}

/**
 * Load Noto Sans Arabic for ImageResponse.
 *
 * Uses filesystem read (not fetch(import.meta.url)) because Next 16 Turbopack
 * still rejects local file URL fetches ("not implemented... yet...").
 * Returns a fresh ArrayBuffer copy each call — @vercel/og may detach buffers.
 */
export async function loadArabicOgFonts(): Promise<OgFont[]> {
  const bytes = await readFontFile("NotoSansArabic-Regular.ttf");
  return [
    {
      name: ARABIC_OG_FONT_FAMILY,
      data: copyBuffer(bytes),
      weight: 400,
      style: "normal",
    },
  ];
}

/**
 * Load the tenant's brand faces for OG, plus Noto as a shaping fallback.
 */
export async function loadBrandOgFonts(typography: BrandTypography): Promise<OgFont[]> {
  const fonts: OgFont[] = [];
  const loaded = new Set<string>();

  for (const face of uniqueBrandFontFaces(typography)) {
    const fileName = fileForFace(face.family, face.weight);
    if (!fileName) continue;
    const key = `${face.family}:${face.weight}:${fileName}`;
    if (loaded.has(key)) continue;
    try {
      const bytes = await readFontFile(fileName);
      fonts.push({
        name: face.family,
        data: copyBuffer(bytes),
        weight: snapBrandFontWeight(face.family, face.weight),
        style: "normal",
      });
      loaded.add(key);
    } catch (error) {
      console.warn("[og-font] failed to load brand face:", face.family, face.weight, error);
    }
  }

  const fallback = await loadArabicOgFonts();
  for (const font of fallback) {
    const key = `${font.name}:${font.weight}`;
    if (loaded.has(key)) continue;
    fonts.push(font);
    loaded.add(key);
  }

  return fonts;
}
