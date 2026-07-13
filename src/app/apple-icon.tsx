import { ImageResponse } from "next/og";
import { APP_NAME, APP_THEME_COLOR } from "@/lib/constants";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(135deg, ${APP_THEME_COLOR} 0%, #155e75 100%)`,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          color: "#FFFFFF",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -2,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {APP_NAME.slice(0, 1)}
      </div>
    ),
    { ...size }
  );
}
