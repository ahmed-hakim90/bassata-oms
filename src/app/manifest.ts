import type { MetadataRoute } from "next";
import {
  APP_DESCRIPTION_AR,
  APP_NAME,
  APP_TAGLINE_AR,
  APP_THEME_COLOR,
} from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE_AR}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION_AR,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: APP_THEME_COLOR,
    lang: "ar",
    dir: "rtl",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
