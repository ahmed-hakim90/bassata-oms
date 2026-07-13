import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnlineMenuOrderingClient } from "@/modules/online-menu/components/online-menu-ordering-client";
import { getOnlineMenuBySlug } from "@/modules/online-menu/services/online-menu.service";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
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
  const token = firstSearchParam((await searchParams).token);
  const menu = await getOnlineMenuBySlug(slug, { token });
  if (!menu) notFound();
  const logoUrl = menu.store.logoUrl ?? menu.organization.logoUrl;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_35%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section
          className="overflow-hidden rounded-3xl border border-border/50 bg-card/95 backdrop-blur"
          style={{ boxShadow: "var(--mds-elevation-3)" }}
        >
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={menu.store.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                  {menu.store.name.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">{menu.organization.name}</p>
                <h1 className="text-3xl font-semibold tracking-tight">{menu.store.name}</h1>
                {menu.store.address ? (
                  <p className="mt-1 text-sm text-muted-foreground">{menu.store.address}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">منيو أونلاين</Badge>
              {menu.store.canOrder ? (
                <Badge>الطلبات متاحة</Badge>
              ) : menu.store.orderingEnabled ? (
                <Badge variant="outline">مغلق للطلب الآن</Badge>
              ) : (
                <Badge variant="outline">للعرض فقط</Badge>
              )}
            </div>
          </div>
          {menu.store.description ? (
            <div className="border-t border-border/40 px-6 py-4 text-sm text-muted-foreground">
              {menu.store.description}
            </div>
          ) : null}
          {!menu.store.canOrder ? (
            <div className="border-t border-amber-200/60 bg-amber-50 px-6 py-4 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-medium">المنيو مفتوح للتصفح — الطلب غير متاح حالياً</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                {menu.store.availability.messageAr}
              </p>
            </div>
          ) : null}
        </section>

        {menu.store.phone ? (
          <section
            className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ boxShadow: "var(--mds-elevation-1)" }}
          >
            <div>
              <p className="font-medium">للطلب أو الاستفسار</p>
              <p className="text-sm text-muted-foreground">تواصل مع الفرع مباشرة.</p>
            </div>
            <Button nativeButton={false} render={<a href={`tel:${menu.store.phone}`} />}>
              اتصل بالفرع
            </Button>
          </section>
        ) : null}

        <OnlineMenuOrderingClient slug={slug} token={token} menu={menu} />
      </div>
    </main>
  );
}
