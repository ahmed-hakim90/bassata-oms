"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { OperationalCard } from "@/components/Velora/operational-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatMenuThemePriceEgp,
  type MenuThemeAccessRow,
  type MenuThemeEntitlements,
} from "@/modules/online-menu/lib/menu-theme-commerce";
import type { MenuThemeSlug } from "@/modules/online-menu/lib/menu-themes";
import { setOrgMenuThemeEntitlementsAction } from "@/modules/platform/actions/platform.actions";

export function PlatformOrgMenuThemesPanel({
  orgId,
  initialRows,
  initialEntitlements,
}: {
  orgId: string;
  initialRows: MenuThemeAccessRow[];
  initialEntitlements: MenuThemeEntitlements;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState<Set<MenuThemeSlug>>(
    () => new Set(initialEntitlements.enabledThemes)
  );
  const [notes, setNotes] = useState(initialEntitlements.notes);

  return (
    <OperationalCard title="ثيمات المنيو للشركة">
      <p className="mb-3 text-sm text-muted-foreground">
        فعّل الثيمات المسموح بها لهذه الشركة. الأسعار من الكتالوج العام (للعرض/التحصيل اليدوي).
      </p>
      <div className="space-y-2">
        {initialRows.map((row) => {
          const checked = enabled.has(row.slug);
          const lockedGlobal = !row.globallyAvailable && row.slug !== "classic";
          return (
            <label
              key={row.slug}
              className="flex flex-col gap-1 rounded-md border border-border/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={pending || lockedGlobal || row.slug === "classic"}
                  onCheckedChange={(v) => {
                    setEnabled((prev) => {
                      const next = new Set(prev);
                      if (v === true) next.add(row.slug);
                      else next.delete(row.slug);
                      next.add("classic");
                      return next;
                    });
                  }}
                />
                <span className="font-medium">{row.nameAr}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {row.slug}
                </span>
              </span>
              <span className="text-xs text-muted-foreground sm:text-end">
                {formatMenuThemePriceEgp(row.priceEgp)}
                {lockedGlobal ? " · متوقف عالميًا" : ""}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 space-y-1">
        <Label className="text-xs">ملاحظة داخلية</Label>
        <Input
          value={notes}
          disabled={pending}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: باقة نمو — ثيم سول مفعّل"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await setOrgMenuThemeEntitlementsAction({
                orgId,
                enabledThemes: Array.from(enabled),
                notes,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setEnabled(new Set(result.data.enabledThemes));
              setNotes(result.data.notes);
              toast.success("تم تحديث ثيمات الشركة");
            });
          }}
        >
          حفظ تفعيل الثيمات
        </Button>
      </div>
    </OperationalCard>
  );
}
