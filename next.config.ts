import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Arabic OG TTF available to ImageResponse serverless functions.
  outputFileTracingIncludes: {
    "/menu/[slug]/opengraph-image": [
      "./public/fonts/NotoSansArabic-Regular.ttf",
      "./public/og/heroes/**/*",
    ],
    "/opengraph-image": ["./public/fonts/NotoSansArabic-Regular.ttf"],
  },
};

export default nextConfig;
