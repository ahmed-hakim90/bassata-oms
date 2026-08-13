import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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
import { getOnlineMenuForOrg } from "@/modules/online-menu/services/online-menu.service";
import { recordOnlineMenuView } from "@/modules/online-menu/services/online-menu-views.service";
import { getHostBoundOrgId } from "@/lib/tenancy/host-org-session";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type HostMenuPageProps = {
  searchParams: Promise<{
    src?: string | string[];
    utm_source?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata(): Promise<Metadata> {
  const orgId = await getHostBoundOrgId();
  if (!orgId) {
    return { title: { absolute: "اطلب أونلاين" }, robots: { index: false, follow: false } };
  }
  const menu = await getOnlineMenuForOrg(orgId, { skipRateLimit: true });
  if (!menu) {
    return { title: { absolute: "اطلب أونلاين" }, robots: { index: false, follow: false } };
  }
  const businessName =
    menu.organization.name.trim() || menu.store.name.trim() || "اطلب أونلاين";
  const title = menu.store.og.title?.trim() || businessName;
  const description =
    menu.store.og.description?.trim() || menu.store.description.trim() || businessName;
  const menuUrl = `${getSiteUrl()}/menu`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: menuUrl },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      url: menuUrl,
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

export default async function HostOnlineMenuPage({ searchParams }: HostMenuPageProps) {
  const orgId = await getHostBoundOrgId();
  if (!orgId) {
    redirect(`${getSiteUrl()}/`);
  }

  const menu = await getOnlineMenuForOrg(orgId);
  if (!menu) notFound();

  const query = await searchParams;
  const sourceHint = firstSearchParam(query.src) ?? firstSearchParam(query.utm_source);
  const headerList = await headers();
  if (!isOnlineMenuViewBot(headerList.get("user-agent"))) {
    void recordOnlineMenuView({
      slug: menu.store.menuSlug,
      orgId,
      source: normalizeOnlineMenuViewSource(sourceHint || "host"),
    });
  }

  const theme = getMenuTheme(menu.store.theme);
  const logoUrl = menu.store.logoUrl ?? menu.organization.logoUrl;
  const coverUrl = menu.store.coverUrl;
  const isPremiumBrand = isPremiumMenuBrand(theme);
  if (!menu.store.menuSlug) notFound();

  return (
    <OnlineMenuShell theme={theme} typography={menu.store.typography}>
      <OnlineMenuHeader menu={menu} theme={theme} logoUrl={logoUrl} coverUrl={coverUrl} />

      <div
        className={[
          "mx-auto flex w-full flex-col gap-6 px-4 pb-6 pt-4 sm:px-6 lg:px-8",
          isPremiumBrand ? "max-w-5xl" : "max-w-4xl",
        ].join(" ")}
      >
        <OnlineMenuOrderingClient slug={menu.store.menuSlug} menu={menu} />
      </div>
    </OnlineMenuShell>
  );
}
