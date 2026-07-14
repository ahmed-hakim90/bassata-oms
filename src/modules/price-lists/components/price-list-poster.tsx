"use client";

import { formatCurrency } from "@/lib/format";
import type { PriceListPrintPayload } from "@/modules/price-lists/lib/formats";
import { firstGrapheme } from "@/lib/first-grapheme";

export type PosterRow = PriceListPrintPayload["rows"][number];

type PriceListPosterProps = {
  width: number;
  height: number;
  orgName: string;
  orgLogoUrl: string | null;
  showLogo: boolean;
  listTitle: string;
  sectionTitle: string;
  footerText: string;
  background: string;
  accent: string;
  rows: PosterRow[];
  showOldPrice: boolean;
  className?: string;
};

function formatPriceBadge(value: number): string {
  return formatCurrency(value, "EGP", "ar-EG", { compact: "egp-glyph" });
}

function Sparkles({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="opacity-80">
      <path
        d="M14 2 L15.5 11 L24 12.5 L15.5 14 L14 23 L12.5 14 L4 12.5 L12.5 11 Z"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PriceListPoster({
  width,
  height,
  orgName,
  orgLogoUrl,
  showLogo,
  listTitle,
  sectionTitle,
  footerText,
  background,
  accent,
  rows,
  showOldPrice,
  className,
}: PriceListPosterProps) {
  const cardBg = "#FFF9E6";
  const padX = Math.round(width * 0.055);
  const titleSize = Math.round(width * 0.055);
  const sectionSize = Math.round(width * 0.042);
  const nameSize = Math.round(width * 0.034);
  const metaSize = Math.round(width * 0.026);
  const priceSize = Math.round(width * 0.032);
  const rowH = Math.max(72, Math.round(width * 0.085));
  const rowGap = Math.max(10, Math.round(width * 0.018));
  const imageSize = Math.round(rowH * 0.72);

  return (
    <div
      dir="rtl"
      className={className}
      data-price-list-poster
      style={{
        width,
        height,
        minHeight: height,
        background,
        color: accent,
        fontFamily: "Cairo, Tahoma, Arial, sans-serif",
        position: "relative",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", top: 18, right: padX, opacity: 0.7 }}>
        <Sparkles color={accent} />
      </div>
      <div style={{ position: "absolute", top: 40, left: padX, opacity: 0.55 }}>
        <Sparkles color={accent} />
      </div>

      <header
        style={{
          padding: `${Math.round(width * 0.04)}px ${padX}px ${Math.round(width * 0.025)}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {showLogo && orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={orgLogoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: Math.round(width * 0.22),
              height: Math.round(width * 0.22),
              objectFit: "contain",
              borderRadius: 16,
            }}
          />
        ) : showLogo ? (
          <div
            style={{
              width: Math.round(width * 0.18),
              height: Math.round(width * 0.18),
              borderRadius: "50%",
              background: accent,
              color: background,
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: Math.round(width * 0.07),
            }}
          >
            {firstGrapheme(orgName || "V", "V")}
          </div>
        ) : null}

        <h1
          style={{
            margin: 0,
            fontSize: titleSize,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {listTitle || orgName}
        </h1>

        {sectionTitle ? (
          <div
            style={{
              marginTop: 4,
              background: accent,
              color: "#fff",
              padding: `${Math.round(width * 0.018)}px ${Math.round(width * 0.07)}px`,
              borderRadius: 999,
              fontSize: sectionSize,
              fontWeight: 800,
              transform: "rotate(-1.5deg)",
              boxShadow: "0 6px 0 rgba(0,0,0,0.12)",
              maxWidth: "92%",
              textAlign: "center",
            }}
          >
            {sectionTitle}
          </div>
        ) : null}
      </header>

      <main
        style={{
          flex: "1 0 auto",
          padding: `0 ${padX}px 12px`,
          display: "flex",
          flexDirection: "column",
          gap: rowGap,
          overflow: "visible",
        }}
      >
        {rows.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              opacity: 0.7,
              fontSize: metaSize,
              marginTop: 40,
            }}
          >
            مفيش أصناف في القائمة
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              data-price-list-row
              style={{
                display: "flex",
                alignItems: "center",
                gap: Math.round(width * 0.02),
                background: cardBg,
                borderRadius: Math.round(rowH * 0.28),
                minHeight: rowH,
                boxShadow: "0 4px 10px rgba(74,44,42,0.12)",
                overflow: "hidden",
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.imageUrl}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    width: imageSize,
                    height: imageSize,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginInline: 10,
                    flexShrink: 0,
                    background: "#fff",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: imageSize,
                    height: imageSize,
                    borderRadius: 12,
                    marginInline: 10,
                    flexShrink: 0,
                    background: accent,
                    opacity: 0.12,
                  }}
                />
              )}

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2,
                  paddingInline: 4,
                  textAlign: "right",
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: nameSize,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                </span>
                <span
                  style={{
                    fontSize: metaSize,
                    opacity: 0.75,
                    fontWeight: 600,
                  }}
                >
                  {[row.weightLine, row.packUnitLabel].filter(Boolean).join(" · ")}
                </span>
              </div>

              <div
                style={{
                  background: accent,
                  color: "#fff",
                  minWidth: Math.round(width * 0.16),
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 10px",
                  borderRadius: `${Math.round(rowH * 0.28)}px 0 0 ${Math.round(rowH * 0.28)}px`,
                  fontWeight: 800,
                  fontSize: priceSize,
                  lineHeight: 1.2,
                }}
              >
                {showOldPrice && row.oldPrice != null && row.oldPrice > row.displayPrice ? (
                  <span
                    style={{
                      fontSize: Math.round(priceSize * 0.72),
                      textDecoration: "line-through",
                      opacity: 0.75,
                      fontWeight: 600,
                    }}
                  >
                    {formatPriceBadge(row.oldPrice)}
                  </span>
                ) : null}
                <span>{formatPriceBadge(row.displayPrice)}</span>
              </div>
            </div>
          ))
        )}
      </main>

      <footer
        style={{
          marginTop: "auto",
          background: accent,
          color: "#fff",
          padding: `${Math.round(width * 0.03)}px ${padX}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            border: "2px dashed rgba(255,255,255,0.55)",
            borderRadius: 14,
            padding: `${Math.round(width * 0.016)}px ${Math.round(width * 0.04)}px`,
            fontSize: Math.round(width * 0.028),
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "100%",
          }}
        >
          {footerText}
        </div>
      </footer>
    </div>
  );
}
