import { ImageResponse } from "next/og";
import { firstGrapheme } from "@/lib/first-grapheme";
import {
  ARABIC_OG_FONT_FAMILY,
  loadArabicOgFonts,
} from "@/lib/og/arabic-og-font";
import { compactArabicOgSpaces } from "@/lib/og/compact-arabic-og-spaces";
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

type OgFonts = Awaited<ReturnType<typeof loadArabicOgFonts>>;

function ogLine(value: string): string {
  return orderOgTextForSatori(compactArabicOgSpaces(sanitizeOgText(value)));
}

async function loadLogoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > 1_200_000) return null;
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

function buildCard(input: {
  title: string;
  subtitle: string | null;
  monogram: string;
  logoDataUrl: string | null;
  fonts: OgFonts;
}) {
  const title = ogLine(input.title);
  const subtitle = input.subtitle ? ogLine(input.subtitle) : null;
  const titleSize = title.length > 28 ? 52 : title.length > 18 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0b1220",
          fontFamily: ARABIC_OG_FONT_FAMILY,
          color: "#fff7ed",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 18% 20%, rgba(251,146,60,0.35), transparent 42%), radial-gradient(circle at 88% 78%, rgba(14,116,144,0.38), transparent 46%), linear-gradient(160deg, #0f172a 0%, #111827 55%, #1c1917 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              borderRadius: 40,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(15, 23, 42, 0.78)",
              padding: "40px 52px",
            }}
          >
            <div
              style={{
                width: 148,
                height: 148,
                borderRadius: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                overflow: "hidden",
                boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
              }}
            >
              {input.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={input.logoDataUrl}
                  width={148}
                  height={148}
                  alt=""
                  style={{ objectFit: "cover", width: 148, height: 148 }}
                />
              ) : (
                <div style={{ display: "flex", fontSize: 64, color: "#fdba74" }}>
                  {input.monogram}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(251, 146, 60, 0.16)",
                border: "1px solid rgba(251, 146, 60, 0.38)",
                color: "#fdba74",
                fontSize: 24,
              }}
            >
              {ogLine("منيو إلكتروني")}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                fontSize: titleSize,
                lineHeight: 1.25,
                maxWidth: 980,
                color: "#fff7ed",
              }}
            >
              {title}
            </div>

            {subtitle ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  textAlign: "center",
                  fontSize: 30,
                  color: "rgba(255,247,237,0.78)",
                  maxWidth: 820,
                }}
              >
                {subtitle}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                marginTop: 8,
                padding: "16px 34px",
                borderRadius: 999,
                background: "#f97316",
                color: "#111827",
                fontSize: 28,
                boxShadow: "0 12px 30px rgba(249,115,22,0.35)",
              }}
            >
              {ogLine("افتح المنيو")}
            </div>
          </div>
        </div>
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
    let logoDataUrl: string | null = null;

    try {
      const meta = await getOnlineMenuOgMetaBySlug(slug);
      if (meta) {
        title = sanitizeOgText(meta.businessName);
        subtitle = meta.branchLabel
          ? sanitizeOgText(meta.branchLabel, "")
          : null;
        if (!subtitle) subtitle = null;
        logoDataUrl = await loadLogoDataUrl(meta.logoUrl);
      }
    } catch (error) {
      console.warn("[menu-og] meta lookup failed:", error);
    }

    return buildCard({
      title,
      subtitle,
      monogram: firstGrapheme(title, "م"),
      logoDataUrl,
      fonts,
    });
  } catch (error) {
    console.error("[menu-og] image render failed:", error);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#111827",
            color: "#fff7ed",
            fontSize: 56,
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
