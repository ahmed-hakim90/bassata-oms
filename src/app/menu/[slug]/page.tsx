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
};

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getOnlineMenuBySlug(slug);
  if (!menu) return { title: "منيو أونلاين" };
  return {
    title: `منيو ${menu.store.name}`,
    description: menu.store.description || `المنيو العام لـ ${menu.store.name}`,
  };
}

export default async function OnlineMenuPage({ params }: MenuPageProps) {
  const { slug } = await params;
  const menu = await getOnlineMenuBySlug(slug);
  if (!menu) notFound();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_35%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-xl shadow-black/[0.05] backdrop-blur">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {menu.organization.logoUrl ? (
                <Image
                  src={menu.organization.logoUrl}
                  alt={menu.organization.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                  {menu.organization.name.slice(0, 1)}
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
              {menu.store.orderingEnabled ? (
                <Badge>الطلبات متاحة</Badge>
              ) : (
                <Badge variant="outline">للعرض فقط</Badge>
              )}
            </div>
          </div>
          {menu.store.description ? (
            <div className="border-t border-border/60 px-6 py-4 text-sm text-muted-foreground">
              {menu.store.description}
            </div>
          ) : null}
        </section>

        {menu.store.phone ? (
          <section className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card/80 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">للطلب أو الاستفسار</p>
              <p className="text-sm text-muted-foreground">تواصل مع الفرع مباشرة.</p>
            </div>
            <Button nativeButton={false} render={<a href={`tel:${menu.store.phone}`} />}>
              اتصل بالفرع
            </Button>
          </section>
        ) : null}

        <OnlineMenuOrderingClient slug={slug} menu={menu} />
      </div>
    </main>
  );
}
