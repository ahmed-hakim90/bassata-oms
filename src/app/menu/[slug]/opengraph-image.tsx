import { ImageResponse } from "next/og";
import {
  ARABIC_OG_FONT_FAMILY,
  loadArabicOgFonts,
} from "@/lib/og/arabic-og-font";
import {
  orderOgTextForSatori,
  sanitizeOgText,
} from "@/lib/og/sanitize-og-text";
import { getOnlineMenuOgMetaBySlug } from "@/modules/online-menu/services/online-menu.service";

export const alt = "منيو أونلاين";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Cache share cards — crawlers re-fetch aggressively. */
export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

function buildCard(input: {
  title: string;
  subtitle: string | null;
  fonts: Awaited<ReturnType<typeof loadArabicOgFonts>>;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 72,
          background: "linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0e7490 100%)",
          color: "#ffffff",
          fontFamily: ARABIC_OG_FONT_FAMILY,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.8,
            marginBottom: 20,
          }}
        >
          {orderOgTextForSatori(sanitizeOgText("منيو أونلاين"))}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 400,
            lineHeight: 1.2,
            maxWidth: 980,
          }}
        >
          {orderOgTextForSatori(input.title)}
        </div>
        {input.subtitle ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 32,
              opacity: 0.9,
              maxWidth: 920,
            }}
          >
            {orderOgTextForSatori(input.subtitle)}
          </div>
        ) : null}
      </div>
    ),
    { ...size, fonts: input.fonts }
  );
}

export default async function MenuOpenGraphImage({ params }: Props) {
  const { slug } = await params;

  try {
    const fonts = await loadArabicOgFonts();
    let title = sanitizeOgText("منيو أونلاين");
    let subtitle: string | null = null;

    try {
      const meta = await getOnlineMenuOgMetaBySlug(slug);
      if (meta) {
        title = sanitizeOgText(meta.businessName);
        subtitle = meta.branchLabel
          ? sanitizeOgText(meta.branchLabel, "")
          : null;
        if (!subtitle) subtitle = null;
      }
    } catch (error) {
      console.warn("[menu-og] meta lookup failed:", error);
    }

    return buildCard({ title, subtitle, fonts });
  } catch (error) {
    console.error("[menu-og] image render failed:", error);
    // Last-resort Latin-only card so crawlers stop getting 500s.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: 64,
            fontFamily: "sans-serif",
          }}
        >
          Online Menu
        </div>
      ),
      { ...size }
    );
  }
}
