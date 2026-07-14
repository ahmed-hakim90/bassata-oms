import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnlineMenuHeader } from "@/modules/online-menu/components/online-menu-header";
import { OnlineMenuOrderingClient } from "@/modules/online-menu/components/online-menu-ordering-client";
import { getMenuTheme } from "@/modules/online-menu/lib/menu-themes";
import { getOnlineMenuBySlug } from "@/modules/online-menu/services/online-menu.service";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[]; theme?: string | string[] }>;
};

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata({ params, searchParams }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const token = firstSearchParam((await searchParams).token);
  const menu = await getOnlineMenuBySlug(slug, { token, skipRateLimit: true });
  if (!menu) {
    return {
      title: { absolute: "منيو أونلاين" },
      robots: { index: false, follow: false },
    };
  }

  // Public menu must read as the merchant (النشاط), never the Velora product brand.
  const businessName =
    menu.organization.name.trim() || menu.store.name.trim() || "منيو أونلاين";
  const description =
    menu.store.description.trim() ||
    `منيو ${businessName}${menu.store.name && menu.store.name !== businessName ? ` — ${menu.store.name}` : ""}`;
  const noIndex = Boolean(token);

  return {
    title: { absolute: businessName },
    description,
    applicationName: businessName,
    authors: [{ name: businessName }],
    creator: businessName,
    publisher: businessName,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      siteName: businessName,
      title: businessName,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: businessName,
      description,
    },
  };
}

export default async function OnlineMenuPage({ params, searchParams }: MenuPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const token = firstSearchParam(query.token);
  const themeOverride = firstSearchParam(query.theme);
  const menu = await getOnlineMenuBySlug(slug, { token, themeOverride });
  if (!menu) notFound();

  const theme = getMenuTheme(menu.store.theme);
  const logoUrl = menu.store.logoUrl ?? menu.organization.logoUrl;
  const coverUrl = menu.store.coverUrl;
  const isPremiumBrand = theme.slug === "antika" || theme.slug === "soul";

  return (
    <main
      className={[
        "min-h-screen text-foreground",
        theme.cssClass ??
          "bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--primary)_12%,transparent),_transparent_35%),linear-gradient(180deg,_var(--background),_color-mix(in_srgb,var(--muted)_45%,var(--background)))]",
      ]
        .filter(Boolean)
        .join(" ")}
      data-menu-theme={theme.slug}
    >
      <OnlineMenuHeader menu={menu} theme={theme} logoUrl={logoUrl} coverUrl={coverUrl} />

      <div
        className={[
          "mx-auto flex w-full flex-col gap-6 px-4 pb-6 pt-4 sm:px-6 lg:px-8",
          isPremiumBrand ? "max-w-5xl" : "max-w-4xl",
        ].join(" ")}
      >
        <OnlineMenuOrderingClient slug={slug} token={token} menu={menu} />
      </div>
    </main>
  );
}
