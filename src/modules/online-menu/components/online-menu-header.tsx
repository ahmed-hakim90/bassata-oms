import Image from "next/image";
import { Clock, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firstGrapheme } from "@/lib/first-grapheme";
import type { MenuThemeDefinition } from "@/modules/online-menu/lib/menu-themes";
import type { OnlineMenuData } from "@/modules/online-menu/services/online-menu.service";

type OnlineMenuHeaderProps = {
  menu: OnlineMenuData;
  theme: MenuThemeDefinition;
  logoUrl: string | null;
  coverUrl: string | null;
};

function AvailabilityBadges({ menu }: { menu: OnlineMenuData }) {
  return (
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
  );
}

function ClosedNotice({ menu }: { menu: OnlineMenuData }) {
  if (menu.store.canOrder) return null;
  return (
    <div className="border-t border-amber-200/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-medium">المنيو مفتوح للتصفح — الطلب غير متاح حالياً</p>
      <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
        {menu.store.availability.messageAr}
      </p>
    </div>
  );
}

function BrandTriptychHeader({
  menu,
  logoUrl,
  coverUrl,
  variant,
}: {
  menu: OnlineMenuData;
  logoUrl: string | null;
  coverUrl: string | null;
  variant: "antika" | "soul";
}) {
  const isSoul = variant === "soul";
  const accent = isSoul ? "#d4af37" : "#b67b31";
  const muted = isSoul ? "#a89f8f" : "#6f5640";
  const panelBg = isSoul ? "#252018" : "#fffaf1";
  const pageBg = isSoul ? "#1c1915" : "#f5eee3";
  const ink = isSoul ? "#f5f0e8" : "#2a160f";
  const stamp = isSoul ? "SOUL" : "MENU";
  const outlineBtn = isSoul
    ? "h-9 border-[#3d3528] bg-[#252018] text-xs text-[#f5f0e8] hover:bg-[#2a2520] sm:text-sm"
    : "h-9 border-[#d7c7b2] bg-[#fffaf1] text-xs text-[#2a160f] hover:bg-[#f0dfc4] sm:text-sm";

  return (
    <div
      className={`${isSoul ? "soul-header" : "antika-header"} relative overflow-hidden`}
      style={{ background: pageBg, color: ink }}
    >
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:gap-6 sm:py-8 lg:min-h-[420px] lg:grid-cols-[0.85fr_1.1fr_1fr] lg:items-center lg:gap-8 lg:py-10">
        <div
          className="relative flex min-h-56 items-center justify-center border-y-2 px-5 py-8 sm:min-h-64 lg:min-h-72 lg:px-6 lg:py-10"
          style={{
            borderColor: accent,
            background: panelBg,
            boxShadow: isSoul
              ? "inset 0 0 0 1px rgba(212,175,55,0.25)"
              : "inset 0 0 0 1px rgba(182,123,49,0.25)",
          }}
        >
          {!isSoul ? <div className="antika-ornament absolute inset-x-8 top-5 h-20 opacity-20" /> : null}
          {logoUrl ? (
            <div className="relative h-28 w-52 sm:h-32 sm:w-60 lg:h-36 lg:w-64">
              <Image
                src={logoUrl}
                alt={menu.store.name}
                fill
                unoptimized
                priority
                className="object-contain"
                sizes="(max-width: 640px) 208px, 256px"
              />
            </div>
          ) : (
            <div
              className="flex size-24 items-center justify-center rounded-2xl text-4xl font-bold sm:size-28"
              style={{ background: `${accent}22`, color: accent }}
            >
              {firstGrapheme(menu.store.name)}
            </div>
          )}
          <div className="absolute bottom-5 text-center sm:bottom-7 lg:bottom-8">
            <p
              className={`text-xl sm:text-2xl ${isSoul ? "italic" : ""}`}
              style={{ color: accent }}
            >
              Menu
            </p>
            <p
              className="text-xs tracking-[0.32em] sm:text-sm sm:tracking-[0.35em]"
              style={{ color: muted }}
            >
              {stamp}
            </p>
          </div>
        </div>

        <div
          className="relative min-h-56 overflow-hidden border shadow-xl sm:min-h-72 lg:min-h-[340px]"
          style={{ borderColor: isSoul ? "#3d3528" : "#d7c7b2", background: panelBg }}
        >
          {coverUrl ? (
            <>
              <Image
                src={coverUrl}
                alt={menu.organization.name}
                fill
                unoptimized
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, ${pageBg}99, transparent 55%)`,
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${accent}55, transparent 45%), ${panelBg}`,
              }}
            />
          )}
        </div>

        <div className="space-y-4 lg:space-y-5">
          <div>
            <p
              className={`text-xl sm:text-2xl ${isSoul ? "italic" : ""}`}
              style={{ color: accent }}
            >
              {menu.organization.name}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {menu.store.name}
            </h1>
            {menu.store.description ? (
              <p className="mt-3 max-w-xl text-sm leading-7 sm:mt-4 sm:text-base" style={{ color: muted }}>
                {menu.store.description}
              </p>
            ) : null}
          </div>

          <AvailabilityBadges menu={menu} />

          {(menu.store.availability.todayWindowsLabel || menu.store.address) && (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm" style={{ color: muted }}>
              {menu.store.availability.todayWindowsLabel ? (
                <span className="inline-flex items-center gap-2">
                  <Clock className="size-4 shrink-0" style={{ color: accent }} />
                  {menu.store.availability.todayWindowsLabel}
                </span>
              ) : null}
              {menu.store.address ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 shrink-0" style={{ color: accent }} />
                  {menu.store.address}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {menu.store.phone ? (
              <Button
                variant="outline"
                size="sm"
                className={outlineBtn}
                nativeButton={false}
                render={<a href={`tel:${menu.store.phone}`} />}
              >
                <Phone className="size-4" />
                {menu.store.phone}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <ClosedNotice menu={menu} />
    </div>
  );
}

function ClassicCoverHeader({
  menu,
  logoUrl,
  coverUrl,
  theme,
}: {
  menu: OnlineMenuData;
  logoUrl: string | null;
  coverUrl: string | null;
  theme: MenuThemeDefinition;
}) {
  const isBistro = theme.slug === "bistro";

  return (
    <div className="relative">
      <div className="relative h-56 overflow-hidden sm:h-72">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={menu.store.name}
            fill
            unoptimized
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="h-full"
            style={{
              background: isBistro
                ? "linear-gradient(135deg, #1c1915, #3d3528 45%, #141210)"
                : "linear-gradient(135deg, color-mix(in srgb, var(--primary) 35%, transparent), color-mix(in srgb, var(--primary) 8%, transparent))",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="relative -mt-16 px-4 pb-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-end gap-4">
            {logoUrl ? (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background shadow-xl">
                <Image
                  src={logoUrl}
                  alt={menu.store.name}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : (
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary/15 text-3xl font-bold text-primary shadow-xl">
                {firstGrapheme(menu.store.name)}
              </div>
            )}
            <div className="min-w-0 pb-1">
              <p className="text-sm text-muted-foreground">{menu.organization.name}</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{menu.store.name}</h1>
            </div>
          </div>

          {menu.store.description ? (
            <p className="mb-4 max-w-2xl leading-relaxed text-muted-foreground">
              {menu.store.description}
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <AvailabilityBadges menu={menu} />
            {menu.store.address ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {menu.store.address}
              </span>
            ) : null}
          </div>

          {menu.store.phone ? (
            <Button
              size="sm"
              className={isBistro ? "bg-[#c9a84c] text-[#141210] hover:bg-[#d4b85c]" : undefined}
              nativeButton={false}
              render={<a href={`tel:${menu.store.phone}`} />}
            >
              <Phone className="size-4" />
              اتصل بالفرع
            </Button>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/40">
            <ClosedNotice menu={menu} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnlineMenuHeader({ menu, theme, logoUrl, coverUrl }: OnlineMenuHeaderProps) {
  if (theme.slug === "antika" || theme.slug === "soul") {
    return (
      <BrandTriptychHeader
        menu={menu}
        logoUrl={logoUrl}
        coverUrl={coverUrl}
        variant={theme.slug}
      />
    );
  }

  return (
    <ClassicCoverHeader menu={menu} logoUrl={logoUrl} coverUrl={coverUrl} theme={theme} />
  );
}
