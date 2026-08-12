import type { CSSProperties, ReactNode } from "react";
import {
  brandTypographyCssVars,
  buildGoogleFontsCssUrl,
  type BrandTypography,
} from "@/modules/online-menu/lib/brand-typography";
import type { MenuThemeDefinition } from "@/modules/online-menu/lib/menu-themes";

export function BrandFontStylesheet({ typography }: { typography: BrandTypography }) {
  const href = buildGoogleFontsCssUrl(typography);
  if (!href) return null;
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
    </>
  );
}

type OnlineMenuShellProps = {
  theme: MenuThemeDefinition;
  typography: BrandTypography;
  children: ReactNode;
};

export function OnlineMenuShell({ theme, typography, children }: OnlineMenuShellProps) {
  return (
    <>
      <BrandFontStylesheet typography={typography} />
      <main
        className={[
          "min-h-screen text-foreground",
          theme.cssClass ??
            "bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--primary)_12%,transparent),_transparent_35%),linear-gradient(180deg,_var(--background),_color-mix(in_srgb,var(--muted)_45%,var(--background)))]",
        ]
          .filter(Boolean)
          .join(" ")}
        data-menu-theme={theme.slug}
        style={brandTypographyCssVars(typography) as CSSProperties}
      >
        {children}
      </main>
    </>
  );
}

export function isPremiumMenuBrand(theme: MenuThemeDefinition): boolean {
  return theme.slug === "antika" || theme.slug === "soul";
}
