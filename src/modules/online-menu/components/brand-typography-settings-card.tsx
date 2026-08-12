"use client";

import type { CSSProperties } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BrandFontStylesheet } from "@/modules/online-menu/components/online-menu-shell";
import {
  BRAND_FONT_FAMILIES,
  BRAND_FONT_FAMILY_LABELS_AR,
  BRAND_FONT_WEIGHT_LABELS_AR,
  BRAND_FONT_WEIGHTS,
  BRAND_TYPOGRAPHY_ROLE_LABELS_AR,
  BRAND_TYPOGRAPHY_ROLES,
  brandTypographyCssVars,
  snapBrandFontWeight,
  type BrandFontFamily,
  type BrandFontWeight,
  type BrandTypography,
  type BrandTypographyRole,
} from "@/modules/online-menu/lib/brand-typography";

type BrandTypographySettingsCardProps = {
  value: BrandTypography;
  onChange: (next: BrandTypography) => void;
};

function isWeight(value: string): value is `${BrandFontWeight}` {
  return (BRAND_FONT_WEIGHTS as readonly number[]).includes(Number(value));
}

export function BrandTypographySettingsCard({
  value,
  onChange,
}: BrandTypographySettingsCardProps) {
  function updateRole(
    role: BrandTypographyRole,
    patch: Partial<BrandTypography[BrandTypographyRole]>
  ) {
    const family = patch.family ?? value[role].family;
    const requestedWeight = patch.weight ?? value[role].weight;
    onChange({
      ...value,
      [role]: {
        family,
        weight: snapBrandFontWeight(family, requestedWeight),
      },
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border/60 p-3">
      <BrandFontStylesheet typography={value} />
      <div>
        <p className="text-sm font-medium">الهوية والخطوط</p>
        <p className="text-[11px] text-muted-foreground">
          تغيير الخط يظهر مباشرة على الموقع العام وكارت المشاركة.
        </p>
      </div>

      <div className="grid gap-3">
        {BRAND_TYPOGRAPHY_ROLES.map((role) => (
          <div key={role} className="grid gap-2 sm:grid-cols-[7rem_1fr_8rem] sm:items-end">
            <Label className="text-xs text-muted-foreground">
              {BRAND_TYPOGRAPHY_ROLE_LABELS_AR[role]}
            </Label>
            <Select
              value={value[role].family}
              onValueChange={(next) => {
                if (!next) return;
                updateRole(role, { family: next as BrandFontFamily });
              }}
            >
              <SelectTrigger className="h-9" aria-label={`خط ${BRAND_TYPOGRAPHY_ROLE_LABELS_AR[role]}`}>
                <SelectValue>
                  {() => BRAND_FONT_FAMILY_LABELS_AR[value[role].family]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BRAND_FONT_FAMILIES.map((family) => (
                  <SelectItem key={family} value={family} label={BRAND_FONT_FAMILY_LABELS_AR[family]}>
                    {BRAND_FONT_FAMILY_LABELS_AR[family]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(value[role].weight)}
              onValueChange={(next) => {
                if (!next || !isWeight(next)) return;
                updateRole(role, { weight: Number(next) as BrandFontWeight });
              }}
            >
              <SelectTrigger className="h-9" aria-label={`وزن ${BRAND_TYPOGRAPHY_ROLE_LABELS_AR[role]}`}>
                <SelectValue>
                  {() => BRAND_FONT_WEIGHT_LABELS_AR[value[role].weight]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BRAND_FONT_WEIGHTS.map((weight) => (
                  <SelectItem
                    key={weight}
                    value={String(weight)}
                    label={BRAND_FONT_WEIGHT_LABELS_AR[weight]}
                  >
                    {BRAND_FONT_WEIGHT_LABELS_AR[weight]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div
        className="brand-type-preview rounded-xl border border-border/60 bg-muted/30 p-4"
        style={brandTypographyCssVars(value) as CSSProperties}
      >
        <p className="text-[11px] text-muted-foreground">معاينة</p>
        <h2 className="mt-1 text-2xl">نوتيلا وموتزاريلا</h2>
        <p className="font-body mt-1 text-sm text-muted-foreground">
          مزيج لا يقاوم من النوتيلا والموتزاريلا
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            اطلب أونلاين
          </button>
          <span className="font-price text-lg tabular-nums text-primary">85 ج.م</span>
        </div>
      </div>
    </div>
  );
}
