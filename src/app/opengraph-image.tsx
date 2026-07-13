import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE_AR, APP_THEME_COLOR } from "@/lib/constants";

export const alt = `${APP_NAME} — ${APP_TAGLINE_AR}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          fontFamily: "system-ui, sans-serif",
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
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            V
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            {APP_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1,
              maxWidth: 920,
            }}
          >
            {APP_TAGLINE_AR}
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.88,
              maxWidth: 860,
              lineHeight: 1.4,
            }}
          >
            مبيعات · مخزون · مشتريات · تقارير
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
