import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OnlineMenuHeader } from "@/modules/online-menu/components/online-menu-header";
import { OnlineMenuOrderingClient } from "@/modules/online-menu/components/online-menu-ordering-client";
import {
  OnlineMenuShell,
  isPremiumMenuBrand,
} from "@/modules/online-menu/components/online-menu-shell";
import { getMenuTheme } from "@/modules/online-menu/lib/menu-themes";
import {
  isOnlineMenuViewBot,
  normalizeOnlineMenuViewSource,
} from "@/modules/online-menu/lib/online-menu-view-source";
import { getOnlineMenuBySlug } from "@/modules/online-menu/services/online-menu.service";
import { recordOnlineMenuView } from "@/modules/online-menu/services/online-menu-views.service";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    token?: string | string[];
    theme?: string | string[];
    src?: string | string[];
    utm_source?: string | string[];
  }>;
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
      title: { absolute: "اطلب أونلاين" },
      robots: { index: false, follow: false },
    };
  }

  const businessName =
    menu.organization.name.trim() || menu.store.name.trim() || "اطلب أونلاين";
  const title = menu.store.og.title?.trim() || businessName;
  const description =
    menu.store.og.description?.trim() || menu.store.description.trim() || businessName;
  const noIndex = Boolean(token);

  return {
    title: { absolute: title },
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
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function OnlineMenuPage({ params, searchParams }: MenuPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const token = firstSearchParam(query.token);
  const themeOverride = firstSearchParam(query.theme);
  const sourceHint = firstSearchParam(query.src) ?? firstSearchParam(query.utm_source);
  const menu = await getOnlineMenuBySlug(slug, { token, themeOverride });
  if (!menu) notFound();

  const headerList = await headers();
  const userAgent = headerList.get("user-agent");
  if (!isOnlineMenuViewBot(userAgent)) {
    void recordOnlineMenuView({
      slug,
      source: normalizeOnlineMenuViewSource(sourceHint),
    });
  }

  const theme = getMenuTheme(menu.store.theme);
  const logoUrl = menu.store.logoUrl ?? menu.organization.logoUrl;
  const coverUrl = menu.store.coverUrl;
  const isPremiumBrand = isPremiumMenuBrand(theme);

  return (
    <OnlineMenuShell theme={theme} typography={menu.store.typography}>
      <OnlineMenuHeader menu={menu} theme={theme} logoUrl={logoUrl} coverUrl={coverUrl} />

      <div
        className={[
          "mx-auto flex w-full flex-col gap-6 px-4 pb-6 pt-4 sm:px-6 lg:px-8",
          isPremiumBrand ? "max-w-5xl" : "max-w-4xl",
        ].join(" ")}
      >
        <OnlineMenuOrderingClient slug={slug} token={token} menu={menu} />
      </div>
    </OnlineMenuShell>
  );
}
