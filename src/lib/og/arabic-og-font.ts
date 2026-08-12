import { readFile } from "node:fs/promises";
import path from "node:path";

export const ARABIC_OG_FONT_FAMILY = "Noto Sans Arabic";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400;
  style: "normal";
};

let cachedFontBytes: Buffer | null = null;

/**
 * Load Noto Sans Arabic for ImageResponse.
 *
 * Uses filesystem read (not fetch(import.meta.url)) because Next 16 Turbopack
 * still rejects local file URL fetches ("not implemented... yet...").
 * Returns a fresh ArrayBuffer copy each call — @vercel/og may detach buffers.
 */
export async function loadArabicOgFonts(): Promise<OgFont[]> {
  if (!cachedFontBytes) {
    const fontPath = path.join(
      process.cwd(),
      "public/fonts/NotoSansArabic-Regular.ttf"
    );
    cachedFontBytes = await readFile(fontPath);
  }

  const bytes = new Uint8Array(cachedFontBytes.byteLength);
  bytes.set(cachedFontBytes);

  return [
    {
      name: ARABIC_OG_FONT_FAMILY,
      data: bytes.buffer,
      weight: 400,
      style: "normal",
    },
  ];
}
