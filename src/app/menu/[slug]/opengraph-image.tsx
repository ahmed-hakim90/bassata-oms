import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { firstGrapheme } from "@/lib/first-grapheme";
import { loadBrandOgFonts, type OgFont } from "@/lib/og/arabic-og-font";
import { compactArabicOgSpaces } from "@/lib/og/compact-arabic-og-spaces";
import { sanitizeOgText } from "@/lib/og/sanitize-og-text";
import { DEFAULT_BRAND_OG_CTA } from "@/modules/online-menu/lib/brand-og";
import { DEFAULT_BRAND_TYPOGRAPHY } from "@/modules/online-menu/lib/brand-typography";
import { getOnlineMenuOgMetaBySlug } from "@/modules/online-menu/services/online-menu.service";

export const alt = DEFAULT_BRAND_OG_CTA;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Cache share cards — crawlers re-fetch aggressively. */
export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

function ogLine(value: string, fallback = DEFAULT_BRAND_OG_CTA): string {
  return compactArabicOgSpaces(sanitizeOgText(value, fallback));
}

function ogWords(value: string, fallback = DEFAULT_BRAND_OG_CTA): string[] {
  return ogLine(value, fallback).split(" ").filter(Boolean);
}

async function loadRemoteImageDataUrl(url: string | null): Promise<string | null> {
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

async function loadLocalHeroDataUrl(slug: string): Promise<string | null> {
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  if (!safeSlug) return null;
  for (const ext of ["jpg", "jpeg", "png", "webp"] as const) {
    const filePath = path.join(process.cwd(), "public/og/heroes", `${safeSlug}.${ext}`);
    try {
      await access(filePath);
      const bytes = await readFile(filePath);
      if (bytes.byteLength === 0 || bytes.byteLength > 1_200_000) continue;
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${bytes.toString("base64")}`;
    } catch {
      // try next extension
    }
  }
  return null;
}

function WordRow(props: {
  words: string[];
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight?: number;
  gap?: number;
  maxWidth?: number;
}) {
  const style: Record<string, string | number> = {
    display: "flex",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: props.gap ?? 12,
    fontSize: props.fontSize,
    color: props.color,
    fontFamily: props.fontFamily,
    fontWeight: props.fontWeight ?? 400,
  };
  if (typeof props.maxWidth === "number") {
    style.maxWidth = props.maxWidth;
  }

  return (
    <div style={style}>
      {props.words.map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </div>
  );
}

function renderBrandProductOrderCard(input: {
  title: string;
  description: string;
  cta: string;
  monogram: string;
  logoDataUrl: string | null;
  heroDataUrl: string | null;
  fonts: OgFont[];
  headingFamily: string;
  bodyFamily: string;
  buttonFamily: string;
  headingWeight: number;
  bodyWeight: number;
  buttonWeight: number;
}) {
  const titleWords = ogWords(input.title);
  const descriptionWords = input.description.trim()
    ? ogWords(input.description, input.description)
    : [];
  const titleSize = input.title.length > 26 ? 52 : input.title.length > 18 ? 64 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#070b14",
          fontFamily: input.bodyFamily,
          color: "#fff7ed",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 78% 18%, rgba(249,115,22,0.28), transparent 36%), radial-gradient(circle at 18% 82%, rgba(15,23,42,0.9), transparent 40%), linear-gradient(120deg, #05070d 0%, #0b1220 48%, #1c1410 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row-reverse",
            padding: 28,
            gap: 24,
          }}
        >
          <div
            style={{
              width: 520,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: 20,
              padding: "28px 20px 28px 8px",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(253,186,116,0.35)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              }}
            >
              {input.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={input.logoDataUrl}
                  width={96}
                  height={96}
                  alt=""
                  style={{ objectFit: "cover", width: 96, height: 96 }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    fontSize: 44,
                    color: "#fdba74",
                    fontFamily: input.headingFamily,
                    fontWeight: input.headingWeight,
                  }}
                >
                  {input.monogram}
                </div>
              )}
            </div>

            <WordRow
              words={titleWords}
              fontSize={titleSize}
              color="#fff7ed"
              gap={14}
              fontFamily={input.headingFamily}
              fontWeight={input.headingWeight}
            />

            {descriptionWords.length > 0 ? (
              <WordRow
                words={descriptionWords}
                fontSize={26}
                color="rgba(255,247,237,0.78)"
                gap={10}
                maxWidth={480}
                fontFamily={input.bodyFamily}
                fontWeight={input.bodyWeight}
              />
            ) : null}

            <div
              style={{
                display: "flex",
                marginTop: 8,
                padding: "14px 28px",
                borderRadius: 999,
                background: "#f97316",
                color: "#111827",
                fontSize: 24,
                boxShadow: "0 14px 36px rgba(249,115,22,0.38)",
                flexDirection: "row-reverse",
                gap: 8,
                fontFamily: input.buttonFamily,
                fontWeight: input.buttonWeight,
              }}
            >
              {ogWords(input.cta, DEFAULT_BRAND_OG_CTA).map((word, index) => (
                <span key={`cta-${index}`}>{word}</span>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              borderRadius: 32,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "linear-gradient(160deg, #1f2937 0%, #111827 100%)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              position: "relative",
            }}
          >
            {input.heroDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={input.heroDataUrl}
                width={620}
                height={574}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "radial-gradient(circle at 40% 35%, rgba(249,115,22,0.35), transparent 55%), linear-gradient(145deg, #1c1917, #0f172a)",
                  color: "#fdba74",
                  fontSize: 120,
                  fontFamily: input.headingFamily,
                  fontWeight: input.headingWeight,
                }}
              >
                {input.monogram}
              </div>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                background:
                  "linear-gradient(90deg, rgba(7,11,20,0.05) 0%, rgba(7,11,20,0.55) 100%)",
              }}
            />
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
    let title = sanitizeOgText(DEFAULT_BRAND_OG_CTA);
    let description = "";
    let cta = DEFAULT_BRAND_OG_CTA;
    let logoDataUrl: string | null = null;
    let heroDataUrl: string | null = null;
    let typography = DEFAULT_BRAND_TYPOGRAPHY;

    try {
      const meta = await getOnlineMenuOgMetaBySlug(slug);
      if (meta) {
        typography = meta.og.typography;
        title = sanitizeOgText(meta.og.title, meta.businessName);
        description = meta.og.description?.trim()
          ? sanitizeOgText(meta.og.description, meta.og.description)
          : "";
        cta = sanitizeOgText(meta.og.cta, DEFAULT_BRAND_OG_CTA);
        logoDataUrl = await loadRemoteImageDataUrl(meta.logoUrl);
        heroDataUrl =
          (await loadRemoteImageDataUrl(meta.og.image || meta.coverUrl)) ??
          (await loadLocalHeroDataUrl(slug));
      } else {
        heroDataUrl = await loadLocalHeroDataUrl(slug);
      }
    } catch (error) {
      console.warn("[menu-og] meta lookup failed:", error);
      heroDataUrl = await loadLocalHeroDataUrl(slug);
    }

    const fonts = await loadBrandOgFonts(typography);

    return renderBrandProductOrderCard({
      title,
      description,
      cta,
      monogram: firstGrapheme(title, "م"),
      logoDataUrl,
      heroDataUrl,
      fonts,
      headingFamily: typography.heading.family,
      bodyFamily: typography.body.family,
      buttonFamily: typography.button.family,
      headingWeight: typography.heading.weight,
      bodyWeight: typography.body.weight,
      buttonWeight: typography.button.weight,
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
          Order online
        </div>
      ),
      { ...size }
    );
  }
}
