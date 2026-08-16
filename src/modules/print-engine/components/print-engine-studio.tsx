"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { OperationalCard } from "@/components/Velora/operational-card";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { CommercialDocumentView } from "@/modules/print-engine/components/commercial-document-view";
import { sampleCommercialDocument } from "@/modules/print-engine/lib/sample-document";
import { commercialDocumentQrDataUrl } from "@/modules/print-engine/lib/document-qr";
import {
  COMMERCIAL_DOCUMENT_KIND_LABELS,
  COMMERCIAL_DOCUMENT_KINDS,
  duplicatePrintTemplate,
  MAX_PRINT_TEMPLATES,
  normalizePrintBlocks,
  PRINT_DOCUMENT_BLOCK_LABELS,
  PRINT_ENGINE_LAYOUT_LABELS,
  PRINT_ENGINE_LAYOUTS,
  PRINT_LOGO_POSITIONS,
  PRINT_LOGO_SIZES,
  resolvePrintTemplate,
  type CommercialDocumentKind,
  type PrintEngineLayout,
  type PrintEngineSettings,
  type PrintTemplate,
} from "@/modules/print-engine/lib/print-engine-settings";
import { savePrintEngineSettingsAction } from "@/modules/print-engine/actions/print-engine.actions";
import { uploadOrganizationLogoAction } from "@/modules/system/actions/system.actions";

const COLOR_FIELDS = [
  ["primary", "اللون الأساسي"],
  ["accent", "لون مميز"],
  ["tableHeader", "رأس الجدول"],
  ["text", "النص"],
  ["muted", "نص ثانوي"],
  ["border", "الحدود"],
] as const;

const FIELD_TOGGLES = [
  ["showSku", "كود الصنف"],
  ["showUnit", "الوحدة"],
  ["showLineDiscount", "خصم السطر"],
  ["showTaxBreakdown", "تفصيل الضريبة"],
  ["showPartyAddress", "عنوان الطرف"],
  ["showPartyTaxId", "الرقم الضريبي للطرف"],
  ["showNotes", "الملاحظات"],
  ["showAmountInWords", "التفقيط"],
  ["showSignature", "التوقيع والختم"],
  ["showQr", "QR لرقم المستند"],
] as const;

type Props = {
  initialSettings: PrintEngineSettings;
  branding: ReportBranding;
  generatedBy: string;
  canUploadLogo?: boolean;
};

export function PrintEngineStudio({
  initialSettings,
  branding,
  generatedBy,
  canUploadLogo = false,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [activeId, setActiveId] = useState(initialSettings.defaultTemplateId);
  const [brandingState, setBrandingState] = useState(branding);
  const [previewKind, setPreviewKind] = useState<CommercialDocumentKind>("sales_invoice");
  const [pending, startTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sample = useMemo(() => sampleCommercialDocument(previewKind), [previewKind]);
  const template = useMemo(
    () =>
      settings.templates.find((item) => item.id === activeId) ??
      resolvePrintTemplate(settings),
    [settings, activeId]
  );
  const blocks = normalizePrintBlocks(template.blocks);
  const kindOverride = template.documents?.[previewKind];
  const assignedPrintTemplate = resolvePrintTemplate(settings, previewKind);

  useEffect(() => {
    if (!template.fields.showQr) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void commercialDocumentQrDataUrl(sample.number).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [template.fields.showQr, sample.number]);

  function patchTemplate(patchValue: Partial<PrintTemplate>) {
    setSettings((current) => ({
      ...current,
      templates: current.templates.map((item) =>
        item.id === template.id ? { ...item, ...patchValue } : item
      ),
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await savePrintEngineSettingsAction(settings);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSettings(result.data);
      toast.success("تم حفظ القوالب — كل نوع مستند هيطبع بالقالب المعيّن له");
    });
  }

  function uploadLogo(file: File) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("logo", file);
        const url = await uploadOrganizationLogoAction(formData);
        setBrandingState((current) => ({ ...current, orgLogoUrl: url }));
        toast.success("تم رفع الشعار");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل رفع الشعار");
      }
    });
  }

  function createFromActive() {
    if (settings.templates.length >= MAX_PRINT_TEMPLATES) {
      toast.error(`أقصى عدد للقوالب ${MAX_PRINT_TEMPLATES}`);
      return;
    }
    const created = duplicatePrintTemplate(template, `نسخة من ${template.name}`);
    setSettings((current) => ({
      ...current,
      templates: [...current.templates, created],
    }));
    setActiveId(created.id);
    toast.success("اتعمل قالب جديد — عدّله واحفظ");
  }

  function removeActive() {
    if (settings.templates.length <= 1) {
      toast.error("لازم يفضل قالب واحد على الأقل");
      return;
    }
    const remaining = settings.templates.filter((item) => item.id !== template.id);
    const nextDefault =
      settings.defaultTemplateId === template.id
        ? remaining[0].id
        : settings.defaultTemplateId;
    const assignments = { ...settings.assignments };
    for (const kind of COMMERCIAL_DOCUMENT_KINDS) {
      if (assignments[kind] === template.id) delete assignments[kind];
    }
    setSettings({
      templates: remaining,
      defaultTemplateId: nextDefault,
      assignments,
    });
    setActiveId(nextDefault);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    patchTemplate({ blocks: next });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <OperationalCard
          title="قوالب الطباعة"
          description="زي أنظمة ERP: أكتر من قالب، شكل مختلف، وتعيين لكل نوع مستند. مش سحب حر على الصفحة."
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>القالب المفتوح</Label>
              <Select
                value={template.id}
                onValueChange={(value) => {
                  if (value) setActiveId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.templates.map((item) => (
                    <SelectItem key={item.id} value={item.id} label={item.name}>
                      {item.name}
                      {item.id === settings.defaultTemplateId ? " · افتراضي" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>اسم القالب</Label>
              <Input
                value={template.name}
                onChange={(event) => patchTemplate({ name: event.target.value.slice(0, 60) })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={createFromActive}>
                <Copy className="size-4" />
                نسخ قالب
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.templates.length >= MAX_PRINT_TEMPLATES}
                onClick={() => {
                  if (settings.templates.length >= MAX_PRINT_TEMPLATES) return;
                  const created = duplicatePrintTemplate(template, "قالب جديد");
                  created.layout = "classic";
                  setSettings((current) => ({
                    ...current,
                    templates: [...current.templates, created],
                  }));
                  setActiveId(created.id);
                }}
              >
                <Plus className="size-4" />
                قالب فاضي
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={template.id === settings.defaultTemplateId}
                onClick={() =>
                  setSettings((current) => ({ ...current, defaultTemplateId: template.id }))
                }
              >
                جعله افتراضي
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.templates.length <= 1}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                حذف
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              الشعار مشترك لكل القوالب. الشكل والألوان والترتيب خاصين بالقالب المفتوح.
            </p>
          </div>
        </OperationalCard>

        <OperationalCard title="شكل هذا القالب">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>شكل الصفحة</Label>
              <Select
                value={template.layout}
                onValueChange={(value) =>
                  patchTemplate({ layout: value as PrintEngineLayout })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_ENGINE_LAYOUTS.map((layout) => (
                    <SelectItem
                      key={layout}
                      value={layout}
                      label={PRINT_ENGINE_LAYOUT_LABELS[layout]}
                    >
                      {PRINT_ENGINE_LAYOUT_LABELS[layout]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {COLOR_FIELDS.map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  <span>{label}</span>
                  <Input
                    type="color"
                    value={template.colors[key]}
                    onChange={(event) =>
                      patchTemplate({
                        colors: { ...template.colors, [key]: event.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>

            {canUploadLogo ? (
              <div className="space-y-2">
                <Label>شعار الشركة</Label>
                {brandingState.orgLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandingState.orgLogoUrl}
                    alt="شعار الشركة"
                    className="h-16 w-16 rounded-lg object-contain"
                  />
                ) : null}
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadLogo(file);
                    event.target.value = "";
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                اللوجو من{" "}
                <Link href="/settings?tab=business" className="text-primary underline">
                  إعدادات المتجر
                </Link>
                {brandingState.orgLogoUrl ? " — مرفوع." : " — المالك يرفع الشعار."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>موضع اللوجو</Label>
                <Select
                  value={template.logo.position}
                  onValueChange={(value) =>
                    patchTemplate({
                      logo: {
                        ...template.logo,
                        position: value as PrintTemplate["logo"]["position"],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_LOGO_POSITIONS.map((position) => (
                      <SelectItem
                        key={position}
                        value={position}
                        label={position === "start" ? "يمين" : position === "end" ? "يسار" : "وسط"}
                      >
                        {position === "start" ? "يمين" : position === "end" ? "يسار" : "وسط"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>حجم اللوجو</Label>
                <Select
                  value={template.logo.size}
                  onValueChange={(value) =>
                    patchTemplate({
                      logo: {
                        ...template.logo,
                        size: value as PrintTemplate["logo"]["size"],
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_LOGO_SIZES.map((size) => (
                      <SelectItem
                        key={size}
                        value={size}
                        label={size === "sm" ? "صغير" : size === "lg" ? "كبير" : "وسط"}
                      >
                        {size === "sm" ? "صغير" : size === "lg" ? "كبير" : "وسط"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={template.logo.show}
                onChange={(event) =>
                  patchTemplate({ logo: { ...template.logo, show: event.target.checked } })
                }
              />
              إظهار اللوجو
            </label>
          </div>
        </OperationalCard>

        <OperationalCard
          title="ترتيب عناصر الصفحة"
          description="حرّك البلوك لفوق أو لتحت، أو اخفيه. المعاينة على اليسار بتتحدث فورًا."
        >
          <div className="space-y-1">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={block.enabled}
                  onChange={(event) => {
                    const next = blocks.map((item) =>
                      item.id === block.id ? { ...item, enabled: event.target.checked } : item
                    );
                    patchTemplate({ blocks: next });
                  }}
                  aria-label={`إظهار ${PRINT_DOCUMENT_BLOCK_LABELS[block.id]}`}
                />
                <span className="min-w-0 flex-1 text-sm">{PRINT_DOCUMENT_BLOCK_LABELS[block.id]}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  aria-label="تحريك لأعلى"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  aria-label="تحريك لأسفل"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </OperationalCard>

        <OperationalCard title="بيانات الشركة على هذا القالب">
          <div className="space-y-3">
            {(
              [
                ["legalName", "الاسم القانوني"],
                ["taxId", "الرقم الضريبي"],
                ["commercialRegister", "السجل التجاري"],
                ["phone", "الهاتف"],
                ["email", "الإيميل"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={template.company[key]}
                  onChange={(event) =>
                    patchTemplate({
                      company: { ...template.company, [key]: event.target.value },
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>عنوان الشركة</Label>
              <Textarea
                rows={2}
                value={template.company.address}
                onChange={(event) =>
                  patchTemplate({
                    company: { ...template.company, address: event.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>بيانات التحويل البنكي</Label>
              <Textarea
                rows={2}
                value={template.company.bankDetails}
                onChange={(event) =>
                  patchTemplate({
                    company: { ...template.company, bankDetails: event.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>ترويسة عامة</Label>
              <Textarea
                rows={2}
                value={template.headerText}
                onChange={(event) => patchTemplate({ headerText: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>ذيل عام</Label>
              <Textarea
                rows={2}
                value={template.footerText}
                onChange={(event) => patchTemplate({ footerText: event.target.value })}
              />
            </div>
          </div>
        </OperationalCard>

        <OperationalCard title="حقول المستند">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {FIELD_TOGGLES.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.fields[key]}
                  onChange={(event) =>
                    patchTemplate({
                      fields: { ...template.fields, [key]: event.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </OperationalCard>

        <OperationalCard
          title={`تخصيص: ${COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind]}`}
          description="عنوان وذيل هذا النوع داخل القالب المفتوح، وتعيين قالب الطباعة الفعلي"
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>القالب المستخدم عند طباعة هذا النوع</Label>
              <Select
                value={settings.assignments?.[previewKind] || "__default__"}
                onValueChange={(value) => {
                  if (!value) return;
                  setSettings((current) => {
                    const assignments = { ...current.assignments };
                    if (value === "__default__") delete assignments[previewKind];
                    else assignments[previewKind] = value;
                    return { ...current, assignments };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="__default__"
                    label={`الافتراضي (${settings.templates.find((item) => item.id === settings.defaultTemplateId)?.name ?? "—"})`}
                  >
                    الافتراضي
                  </SelectItem>
                  {settings.templates.map((item) => (
                    <SelectItem key={item.id} value={item.id} label={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>عنوان المستند</Label>
              <Input
                placeholder={COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind]}
                value={kindOverride?.title ?? ""}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: { ...kindOverride, title: event.target.value },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>ذيل خاص بهذا النوع</Label>
              <Textarea
                rows={2}
                placeholder="فاضي = الذيل العام"
                value={kindOverride?.footerNote ?? ""}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: { ...kindOverride, footerNote: event.target.value },
                    },
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={kindOverride?.showWatermark === true}
                onChange={(event) =>
                  patchTemplate({
                    documents: {
                      ...template.documents,
                      [previewKind]: {
                        ...kindOverride,
                        showWatermark: event.target.checked,
                      },
                    },
                  })
                }
              />
              علامة مائية (مسودة)
            </label>
          </div>
        </OperationalCard>

        <Button type="button" onClick={save} disabled={pending} className="h-11 w-full font-semibold">
          {pending ? "جاري الحفظ…" : "حفظ كل القوالب"}
        </Button>
      </div>

      <OperationalCard
        title="معاينة A4 مباشرة"
        description={
          assignedPrintTemplate.id === template.id
            ? "المعاينة للقالب المفتوح — نفس اللي هيطبع لهذا النوع"
            : `المعاينة للقالب المفتوح. الطباعة الحقيقية لـ ${COMMERCIAL_DOCUMENT_KIND_LABELS[previewKind]} هتستخدم «${assignedPrintTemplate.name}»`
        }
        action={
          <Select
            value={previewKind}
            onValueChange={(value) => setPreviewKind(value as CommercialDocumentKind)}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_DOCUMENT_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind} label={COMMERCIAL_DOCUMENT_KIND_LABELS[kind]}>
                  {COMMERCIAL_DOCUMENT_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-auto rounded-md border bg-muted/30 p-2">
          <CommercialDocumentView
            branding={brandingState}
            settings={template}
            document={sample}
            generatedBy={generatedBy}
            generatedAt={new Date().toISOString()}
            qrDataUrl={qrDataUrl}
          />
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف القالب؟"
        description={`«${template.name}» هيتشال. المستندات اللي كانت معيّنة عليه هترجع للقالب الافتراضي.`}
        confirmLabel="حذف القالب"
        destructive
        onConfirm={removeActive}
      />
    </div>
  );
}
