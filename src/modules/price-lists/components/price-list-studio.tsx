"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Download,
  Loader2,
  MessageCircle,
  Printer,
  Send,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/digits";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import type { PriceListStudioData } from "@/modules/price-lists/actions/price-list.actions";
import {
  applyDisplayDiscount,
  buildRowsFromProducts,
  reapplyMargin,
  suggestSaleFromCost,
  type PriceListRow,
} from "@/modules/price-lists/lib/build-price-list-rows";
import {
  computePosterHeight,
  DEFAULT_PRICE_LIST_THEME,
  getPriceListFormat,
  PRICE_LIST_FORMATS,
  type PriceListFormatId,
  type PriceListPrintPayload,
} from "@/modules/price-lists/lib/formats";
import {
  downloadDataUrl,
  exportPosterBlob,
  exportPosterJpeg,
  exportPosterPng,
  shareTextUrls,
} from "@/modules/price-lists/lib/export-poster";
import { savePriceListPrintPayload } from "@/modules/price-lists/lib/print-payload";
import { PriceListPoster } from "@/modules/price-lists/components/price-list-poster";

function nextSuggestedSale(row: PriceListRow, marginPercent: number): number {
  if (row.catalogSalePrice > 0) return row.catalogSalePrice;
  return suggestSaleFromCost(row.packCost, marginPercent);
}

type PriceListStudioProps = {
  initial: PriceListStudioData;
};

function buildPosterRows(
  rows: PriceListRow[],
  discountPercent: number,
  showOldPrice: boolean
): PriceListPrintPayload["rows"] {
  return rows.map((row) => {
    const displayPrice = applyDisplayDiscount(row.salePrice, discountPercent);
    const oldPrice =
      showOldPrice && discountPercent > 0
        ? row.salePrice
        : showOldPrice && row.catalogSalePrice > displayPrice
          ? row.catalogSalePrice
          : null;
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      weightLine: row.weightLine,
      packUnitLabel: row.packUnitLabel,
      salePrice: row.salePrice,
      displayPrice,
      oldPrice,
    };
  });
}

export function PriceListStudio({ initial }: PriceListStudioProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, startExport] = useTransition();
  const [rows, setRows] = useState<PriceListRow[]>(initial.rows);
  const [manualIds, setManualIds] = useState<Set<string>>(() => new Set());
  const [marginPercent, setMarginPercent] = useState(String(initial.defaultMarginPercent));
  const [discountPercent, setDiscountPercent] = useState("0");
  const [listTitle, setListTitle] = useState(initial.branding.orgName || "قائمة الأسعار");
  const [sectionTitle, setSectionTitle] = useState("أسعار البيع");
  const [footerText, setFooterText] = useState("الأسعار سارية حتى نفاد الكمية");
  const [showLogo, setShowLogo] = useState(true);
  const [showOldPrice, setShowOldPrice] = useState(false);
  const [background, setBackground] = useState<string>(DEFAULT_PRICE_LIST_THEME.background);
  const [accent, setAccent] = useState<string>(DEFAULT_PRICE_LIST_THEME.accent);
  const [formatId, setFormatId] = useState<PriceListFormatId>("instagram");
  const [productQuery, setProductQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initial.rows.map((r) => r.productId))
  );

  const format = getPriceListFormat(formatId);
  const discount = parseFloat(discountPercent) || 0;
  const posterRows = useMemo(
    () => buildPosterRows(rows, discount, showOldPrice),
    [rows, discount, showOldPrice]
  );

  const applyMargin = useCallback(
    (raw: string) => {
      setMarginPercent(raw);
      const m = parseFloat(raw);
      if (!Number.isFinite(m)) return;
      setRows((prev) => reapplyMargin(prev, m, manualIds));
    },
    [manualIds]
  );

  useEffect(() => {
    const m = parseFloat(marginPercent) || 5;
    const selected = initial.catalog.filter((p) => selectedIds.has(p.id));
    const fromCatalog = buildRowsFromProducts({ products: selected, marginPercent: m });
    setRows((prev) => {
      const prevByProduct = new Map(prev.map((r) => [r.productId, r]));
      return fromCatalog.map((catalogRow) => {
        const existing = prevByProduct.get(catalogRow.productId);
        if (!existing) return catalogRow;
        const suggestedSalePrice = nextSuggestedSale(
          {
            ...existing,
            catalogSalePrice: catalogRow.catalogSalePrice || existing.catalogSalePrice,
          },
          m
        );
        return {
          ...existing,
          catalogSalePrice: catalogRow.catalogSalePrice || existing.catalogSalePrice,
          suggestedSalePrice,
          salePrice: manualIds.has(existing.id) ? existing.salePrice : suggestedSalePrice,
        };
      });
    });
    // Rebuild when selection changes only; margin edits go through applyMargin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, initial.catalog]);

  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return initial.catalog.slice(0, 40);
    return initial.catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [initial.catalog, productQuery]);

  const toggleProduct = (product: Product) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  const updateSalePrice = (rowId: string, raw: string) => {
    const cleaned = sanitizeDecimalInput(raw);
    const value = parseFloat(cleaned);
    setManualIds((prev) => new Set(prev).add(rowId));
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, salePrice: Number.isFinite(value) ? value : row.salePrice }
          : row
      )
    );
  };

  const buildPrintPayload = (): PriceListPrintPayload => ({
    listTitle,
    sectionTitle,
    footerText,
    showLogo,
    showOldPrice,
    discountPercent: discount,
    background,
    accent,
    orgName: initial.branding.orgName,
    orgLogoUrl: initial.branding.orgLogoUrl,
    currency: initial.branding.currency,
    rows: posterRows,
  });

  const runExport = (kind: "png" | "jpg") => {
    const node = posterRef.current;
    if (!node) {
      toast.error("المعاينة مش جاهزة");
      return;
    }
    startExport(async () => {
      try {
        const dataUrl =
          kind === "png"
            ? await exportPosterPng(node, format)
            : await exportPosterJpeg(node, format);
        const stamp = new Date().toISOString().slice(0, 10);
        downloadDataUrl(dataUrl, `price-list-${format.id}-${stamp}.${kind === "png" ? "png" : "jpg"}`);
        toast.success(kind === "png" ? "تم تنزيل PNG" : "تم تنزيل JPG");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل التصدير");
      }
    });
  };

  const openPrintPdf = () => {
    if (posterRows.length === 0) {
      toast.error("اختَر أصناف الأول قبل الطباعة");
      return;
    }
    try {
      savePriceListPrintPayload(buildPrintPayload());
      // Keep opener so the print tab can fall back if storage is blocked.
      const printWindow = window.open("/print/price-list", "_blank");
      if (!printWindow) {
        toast.error("المتصفح منع النافذة المنبثقة — اسمح بالـ Pop-ups وجرب تاني");
      }
    } catch {
      toast.error("مقدرناش نفتح صفحة الطباعة");
    }
  };

  const shareNative = () => {
    const node = posterRef.current;
    if (!node) return;
    startExport(async () => {
      try {
        const blob = await exportPosterBlob(node, format, "image/png");
        if (!blob) throw new Error("فشل إنشاء الصورة");
        const file = new File([blob], `price-list-${format.id}.png`, { type: "image/png" });
        const text = `${listTitle}\n${sectionTitle}\n${footerText}`;
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: listTitle, text });
          return;
        }
        if (navigator.share) {
          await navigator.share({ title: listTitle, text });
          return;
        }
        downloadDataUrl(URL.createObjectURL(blob), file.name);
        toast.message("اتحفظت الصورة — شاركها من جهازك");
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "فشلت المشاركة");
      }
    });
  };

  const shareLinks = shareTextUrls(
    `${listTitle} — ${sectionTitle}\n${rows
      .map((r) => `${r.name}: ${applyDisplayDiscount(r.salePrice, discount)} ج / ${r.packUnitLabel}`)
      .join("\n")}\n${footerText}`
  );

  const posterHeight = useMemo(
    () =>
      computePosterHeight({
        width: format.width,
        minHeight: format.height,
        rowCount: posterRows.length,
        showLogo,
      }),
    [format.width, format.height, posterRows.length, showLogo]
  );
  const previewScale = Math.min(1, 360 / format.width);

  return (
    <div className="space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <PageHeader
        title="قائمة أسعار الجملة"
        description={
          initial.invoiceNumber
            ? `من فاتورة ${initial.invoiceNumber} — السعر الظاهر هو سعر البيع المسجّل للصنف (قابل للتعديل)`
            : "اختر الأصناف وعدّل سعر البيع ثم صدّر للسوشيال أو اطبع"
        }
        action={
          <Link href="/inventory/purchases">
            <Button variant="outline" className="min-h-11">
              رجوع للمشتريات
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-4">
          <OperationalCard accent="var(--mds-color-action-primary)">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="listTitle">اسم القائمة</Label>
                <Input
                  id="listTitle"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sectionTitle">عنوان القسم</Label>
                <Input
                  id="sectionTitle"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="مجمدات · صوصات · موتزريلا"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margin">نسبة ربح مقترحة % (لو مفيش سعر بيع)</Label>
                <Input
                  id="margin"
                  inputMode="decimal"
                  value={marginPercent}
                  onChange={(e) => applyMargin(sanitizeDecimalInput(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount">خصم عرض %</Label>
                <Input
                  id="discount"
                  inputMode="decimal"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(sanitizeDecimalInput(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bg">لون الخلفية</Label>
                <Input
                  id="bg"
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="h-11 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent">لون الهوية</Label>
                <Input
                  id="accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-11 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="footer">عبارة التذييل</Label>
                <Input
                  id="footer"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showLogo} onCheckedChange={(v) => setShowLogo(v === true)} />
                إظهار الشعار
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={showOldPrice}
                  onCheckedChange={(v) => setShowOldPrice(v === true)}
                />
                إظهار السعر القديم
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>مقاس التصدير</Label>
                <Select
                  value={formatId}
                  onValueChange={(v) =>
                    setFormatId((v ?? "instagram") as PriceListFormatId)
                  }
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_LIST_FORMATS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label} ({f.width}×{f.height})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </OperationalCard>

          <OperationalCard>
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="productQuery">اختيار / إضافة أصناف من الكتالوج</Label>
              <Input
                id="productQuery"
                placeholder="ابحث بالاسم أو الباركود…"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </div>
            <div className="grid max-h-56 gap-1 overflow-y-auto">
              {filteredCatalog.map((product) => {
                const checked = selectedIds.has(product.id);
                return (
                  <label
                    key={product.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleProduct(product)}
                    />
                    <span className="flex-1 truncate text-sm">{product.name}</span>
                  </label>
                );
              })}
            </div>
          </OperationalCard>

          <OperationalCard>
            <h3 className="mb-3 font-semibold">أصناف القائمة ({rows.length})</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">اختَر أصناف من الكتالوج أعلاه.</p>
            ) : (
              <div className="grid gap-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-2xl border border-border/60 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        تكلفة {row.packUnitLabel}:{" "}
                        {formatCurrency(row.packCost, initial.branding.currency)}
                        {row.weightLine ? ` · ${row.weightLine}` : ""}
                        {!row.hasPacking ? " · بدون تعبئة شراء" : ""}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">سعر البيع</Label>
                      <Input
                        className="min-h-10 w-28 tabular-nums"
                        inputMode="decimal"
                        value={String(row.salePrice)}
                        onChange={(e) =>
                          updateSalePrice(row.id, sanitizeDecimalInput(e.target.value))
                        }
                      />
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-muted-foreground sm:text-end">
                      في القائمة:{" "}
                      {formatCurrency(
                        applyDisplayDiscount(row.salePrice, discount),
                        initial.branding.currency
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </OperationalCard>

          <OperationalCard>
            <h3 className="mb-3 font-semibold">تصدير ومشاركة</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                onClick={() => runExport("png")}
                disabled={exporting || rows.length === 0}
              >
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                PNG
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => runExport("jpg")}
                disabled={exporting || rows.length === 0}
              >
                JPG
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={openPrintPdf}
                disabled={rows.length === 0}
              >
                <Printer className="size-4" />
                PDF / طباعة
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={shareNative}
                disabled={exporting || rows.length === 0}
              >
                <Share2 className="size-4" />
                مشاركة
              </Button>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <MessageCircle className="size-4" />
                واتساب
              </a>
              <a
                href={shareLinks.telegram}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <Send className="size-4" />
                تيليجرام
              </a>
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <Share2 className="size-4" />
                فيسبوك
              </a>
            </div>
          </OperationalCard>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <OperationalCard>
            <p className="mb-3 text-sm text-muted-foreground">
              معاينة {format.label} — كل الأصناف المختارة ({posterRows.length}) ظاهرة في الصورة
            </p>
            <div className="max-h-[min(80vh,920px)] overflow-x-hidden overflow-y-auto rounded-2xl bg-muted/40 p-3">
              {/*
                Preview stage is LTR for scale math only. Poster keeps its own RTL.
                Outer size = scaled pixels; overflow hidden clips unscaled layout width
                so Instagram (1080) never creates a horizontal scrollbar.
              */}
              <div
                dir="ltr"
                className="relative mx-auto overflow-hidden"
                style={{
                  width: format.width * previewScale,
                  height: posterHeight * previewScale,
                }}
              >
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: format.width,
                    height: posterHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <div ref={posterRef}>
                    <PriceListPoster
                      width={format.width}
                      height={posterHeight}
                      orgName={initial.branding.orgName}
                      orgLogoUrl={initial.branding.orgLogoUrl}
                      showLogo={showLogo}
                      listTitle={listTitle}
                      sectionTitle={sectionTitle}
                      footerText={footerText}
                      background={background}
                      accent={accent}
                      rows={posterRows}
                      showOldPrice={showOldPrice}
                    />
                  </div>
                </div>
              </div>
            </div>
          </OperationalCard>
        </div>
      </div>
    </div>
  );
}
