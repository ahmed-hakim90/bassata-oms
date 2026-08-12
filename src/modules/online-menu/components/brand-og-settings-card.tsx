"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BRAND_OG_TEMPLATES,
  BRAND_OG_TEMPLATE_LABELS_AR,
  type BrandOgConfig,
  type BrandOgTemplate,
} from "@/modules/online-menu/lib/brand-og";

type BrandOgSettingsCardProps = {
  value: BrandOgConfig;
  onChange: (next: BrandOgConfig) => void;
  coverUploading?: boolean;
  onCoverFile?: (file: File) => void;
};

export function BrandOgSettingsCard({
  value,
  onChange,
  coverUploading = false,
  onCoverFile,
}: BrandOgSettingsCardProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/60 p-3">
      <div>
        <p className="text-sm font-medium">مشاركة أونلاين</p>
        <p className="text-[11px] text-muted-foreground">
          صورة المشاركة عند إرسال الرابط على واتساب أو السوشيال — براند + منتج + طلب.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">عنوان المشاركة</Label>
        <Input
          value={value.title ?? ""}
          placeholder="اسم البراند (افتراضي)"
          onChange={(event) =>
            onChange({ ...value, title: event.target.value.trim() ? event.target.value : null })
          }
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">الوصف</Label>
        <Textarea
          rows={3}
          value={value.description ?? ""}
          placeholder="مزيج لا يقاوم من النوتيلا والموتزاريلا"
          onChange={(event) =>
            onChange({
              ...value,
              description: event.target.value.trim() ? event.target.value : null,
            })
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">زر الطلب</Label>
          <Input
            value={value.cta}
            onChange={(event) => onChange({ ...value, cta: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">قالب الصورة</Label>
          <Select
            value={value.template}
            onValueChange={(next) => {
              if (!next) return;
              onChange({ ...value, template: next as BrandOgTemplate });
            }}
          >
            <SelectTrigger className="h-9" aria-label="قالب صورة المشاركة">
              <SelectValue>
                {() => BRAND_OG_TEMPLATE_LABELS_AR[value.template]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BRAND_OG_TEMPLATES.map((template) => (
                <SelectItem
                  key={template}
                  value={template}
                  label={BRAND_OG_TEMPLATE_LABELS_AR[template]}
                >
                  {BRAND_OG_TEMPLATE_LABELS_AR[template]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {onCoverFile ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">صورة المنتج / الغلاف</Label>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={coverUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onCoverFile(file);
              event.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            {value.image ? "صورة مرفوعة — تظهر في كارت المشاركة ورأس الموقع." : "لم يتم اختيار صورة بعد."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
