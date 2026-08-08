"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MENU_THEMES, type MenuThemeSlug } from "@/modules/online-menu/lib/menu-themes";
import {
  formatMenuThemePriceEgp,
  type MenuThemeCatalog,
  type MenuThemeCatalogEntry,
} from "@/modules/online-menu/lib/menu-theme-commerce";
import { updateMenuThemeCatalogAction } from "@/modules/platform/actions/platform.actions";

type DraftEntry = {
  priceEgp: string;
  globallyAvailable: boolean;
  notes: string;
};

function toDraft(catalog: MenuThemeCatalog): Record<MenuThemeSlug, DraftEntry> {
  return Object.fromEntries(
    (Object.keys(catalog) as MenuThemeSlug[]).map((slug) => [
      slug,
      {
        priceEgp: String(catalog[slug].priceEgp),
        globallyAvailable: catalog[slug].globallyAvailable,
        notes: catalog[slug].notes,
      },
    ])
  ) as Record<MenuThemeSlug, DraftEntry>;
}

export function PlatformMenuThemesConsole({
  initialCatalog,
}: {
  initialCatalog: MenuThemeCatalog;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(() => toDraft(initialCatalog));

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="ثيمات المنيو"
        description="أسعار التفعيل وحالة التوفر العامة. التفعيل لكل شركة من صفحة تفاصيل الشركة."
      />

      <OperationalCard title="كتالوج الثيمات">
        <p className="mb-4 text-sm text-muted-foreground">
          الأسعار للعرض والفوترة اليدوية — مش بتتخصم تلقائيًا من التطبيق.
        </p>
        <div className="space-y-4">
          {(Object.keys(draft) as MenuThemeSlug[]).map((slug) => {
            const theme = MENU_THEMES[slug];
            const row = draft[slug];
            return (
              <div
                key={slug}
                className="grid gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-6 w-10 overflow-hidden rounded border"
                      aria-hidden
                    >
                      <span
                        className="w-1/2"
                        style={{ background: theme.previewColors.background }}
                      />
                      <span
                        className="w-1/4"
                        style={{ background: theme.previewColors.primary }}
                      />
                      <span
                        className="w-1/4"
                        style={{ background: theme.previewColors.accent }}
                      />
                    </span>
                    <p className="font-medium">{theme.nameAr}</p>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {slug}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{theme.descriptionAr}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">السعر (ج.م)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      inputMode="decimal"
                      value={row.priceEgp}
                      disabled={pending}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [slug]: { ...row, priceEgp: e.target.value },
                        })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {formatMenuThemePriceEgp(Number(row.priceEgp) || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ملاحظة</Label>
                    <Input
                      value={row.notes}
                      disabled={pending}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [slug]: { ...row, notes: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm md:justify-end">
                  <Checkbox
                    checked={row.globallyAvailable}
                    disabled={pending || slug === "classic"}
                    onCheckedChange={(v) =>
                      setDraft({
                        ...draft,
                        [slug]: { ...row, globallyAvailable: v === true },
                      })
                    }
                  />
                  متاح عالميًا
                </label>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const updates: Partial<
                  Record<MenuThemeSlug, Partial<MenuThemeCatalogEntry>>
                > = {};
                for (const slug of Object.keys(draft) as MenuThemeSlug[]) {
                  const row = draft[slug];
                  updates[slug] = {
                    priceEgp: Number(row.priceEgp),
                    globallyAvailable: row.globallyAvailable,
                    notes: row.notes,
                  };
                }
                const result = await updateMenuThemeCatalogAction(updates);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setDraft(toDraft(result.data));
                toast.success("تم حفظ كتالوج الثيمات");
              });
            }}
          >
            حفظ الأسعار والتوفر
          </Button>
        </div>
      </OperationalCard>
    </div>
  );
}
