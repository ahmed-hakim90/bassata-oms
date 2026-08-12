import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE_AR, APP_THEME_COLOR } from "@/lib/constants";
import {
  ARABIC_OG_FONT_FAMILY,
  loadArabicOgFonts,
} from "@/lib/og/arabic-og-font";
import {
  orderOgTextForSatori,
  sanitizeOgText,
} from "@/lib/og/sanitize-og-text";

export const alt = `${APP_NAME} — ${APP_TAGLINE_AR}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function OpenGraphImage() {
  try {
    const fonts = await loadArabicOgFonts();
    const tagline = sanitizeOgText(APP_TAGLINE_AR, APP_NAME);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            background: `linear-gradient(145deg, ${APP_THEME_COLOR} 0%, #155e75 48%, #0f172a 100%)`,
            color: "#ffffff",
            fontFamily: ARABIC_OG_FONT_FAMILY,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "rgba(255,255,255,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 400,
              }}
            >
              V
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 42,
                fontWeight: 400,
              }}
            >
              {APP_NAME}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 400,
                lineHeight: 1.2,
                maxWidth: 920,
              }}
            >
              {orderOgTextForSatori(tagline)}
            </div>
            <div
              style={{
                fontSize: 28,
                opacity: 0.88,
                maxWidth: 860,
                lineHeight: 1.4,
              }}
            >
              {orderOgTextForSatori(
                sanitizeOgText("مبيعات · مخزون · مشتريات · تقارير", "POS")
              )}
            </div>
          </div>
        </div>
      ),
      { ...size, fonts }
    );
  } catch (error) {
    console.error("[root-og] image render failed:", error);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: APP_THEME_COLOR,
            color: "#ffffff",
            fontSize: 64,
            fontFamily: "sans-serif",
          }}
        >
          {APP_NAME}
        </div>
      ),
      { ...size }
    );
  }
}
