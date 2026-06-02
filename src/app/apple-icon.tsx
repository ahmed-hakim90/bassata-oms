import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2563EB",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <svg
          width="112"
          height="112"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
          <path d="M17 7A5 5 0 0 0 7 7" />
          <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
