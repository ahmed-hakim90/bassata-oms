import type { ReactNode } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { amountInArabicWords } from "@/modules/print-engine/lib/amount-in-words-ar";
import {
  documentTitle,
  normalizePrintBlocks,
  type PrintDocumentBlockId,
} from "@/modules/print-engine/lib/print-engine-settings";
import type { CommercialDocumentViewProps } from "@/modules/print-engine/lib/commercial-document-types";

const LOGO_PX = { sm: 48, md: 72, lg: 96 } as const;

export function CommercialDocumentView({
  branding,
  settings,
  document: doc,
  generatedBy,
  generatedAt,
  qrDataUrl = null,
}: CommercialDocumentViewProps) {
  const colors = settings.colors;
  const title = documentTitle(settings, doc.kind);
  const legalName = settings.company.legalName.trim() || branding.orgName;
  const logoSize = LOGO_PX[settings.logo.size];
  const showWatermark = settings.documents?.[doc.kind]?.showWatermark === true;
  const watermarkText = showWatermark ? doc.watermark?.trim() || "مسودة" : null;
  const footerNote =
    settings.documents?.[doc.kind]?.footerNote?.trim() || settings.footerText.trim();
  const layout = settings.layout;
  const compact = layout === "compact" || layout === "minimal";
  const statement = layout === "statement";
  const modern = layout === "modern";
  const boxed = layout === "boxed";
  const striped = layout === "striped";
  const currency = branding.currency;
  const extraCost = doc.extraCost ?? 0;
  const hideMoney = doc.kind === "delivery_note";
  const blocks = normalizePrintBlocks(settings.blocks);

  const logoBlock =
    settings.logo.show && branding.orgLogoUrl ? (
      <div
        className="shrink-0 overflow-hidden bg-white"
        style={{ width: logoSize, height: logoSize }}
      >
        <Image
          src={branding.orgLogoUrl}
          alt={legalName}
          width={logoSize}
          height={logoSize}
          className="size-full object-contain"
          unoptimized
        />
      </div>
    ) : null;

  const sellerBlock = (
    <div className="min-w-0">
      <p className="text-lg font-bold" style={{ color: colors.primary }}>
        {legalName}
      </p>
      {branding.storeName ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          {branding.storeName}
        </p>
      ) : null}
      {settings.company.address || branding.storeAddress ? (
        <p className="text-xs">{settings.company.address || branding.storeAddress}</p>
      ) : null}
      {settings.company.phone || branding.storePhone ? (
        <p className="text-xs" dir="ltr">
          {settings.company.phone || branding.storePhone}
        </p>
      ) : null}
      {settings.company.email ? <p className="text-xs">{settings.company.email}</p> : null}
      {settings.fields.showPartyTaxId && settings.company.taxId ? (
        <p className="text-xs">الرقم الضريبي: {settings.company.taxId}</p>
      ) : null}
      {settings.company.commercialRegister ? (
        <p className="text-xs">السجل التجاري: {settings.company.commercialRegister}</p>
      ) : null}
    </div>
  );

  const sections: Record<PrintDocumentBlockId, ReactNode> = {
    header: (
      <header
        className={cn("mb-6 pb-4", statement ? "border-b-4" : "border-b")}
        style={{ borderColor: statement || boxed ? colors.primary : colors.border }}
      >
        <div
          className={cn(
            "flex items-start gap-4",
            settings.logo.position === "center" && "flex-col items-center text-center",
            settings.logo.position === "end" && "flex-row-reverse"
          )}
        >
          {logoBlock}
          {sellerBlock}
          <div
            className={cn(
              "min-w-[12rem] rounded-md px-3 py-2 text-end",
              modern && "text-white",
              layout === "minimal" && "rounded-none border-0 px-0"
            )}
            style={
              modern
                ? { background: colors.primary }
                : layout === "minimal"
                  ? undefined
                  : { border: `1px solid ${colors.border}` }
            }
          >
            <p className="text-base font-bold">{title}</p>
            <p className="font-mono text-sm">{doc.number}</p>
            <p className="text-xs opacity-90">{doc.dateLabel}</p>
            {doc.validUntil ? <p className="text-xs">صالح حتى: {doc.validUntil}</p> : null}
          </div>
        </div>
        {settings.headerText || branding.receiptHeader ? (
          <p className="mt-3 whitespace-pre-wrap text-xs" style={{ color: colors.muted }}>
            {settings.headerText || branding.receiptHeader}
          </p>
        ) : null}
      </header>
    ),
    party: (
      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        {doc.party ? (
          <div
            className={cn("p-3", layout === "minimal" ? "px-0" : "rounded-md border")}
            style={layout === "minimal" ? undefined : { borderColor: colors.border }}
          >
            <p className="mb-1 text-xs font-semibold" style={{ color: colors.primary }}>
              {doc.partyLabel}
            </p>
            <p className="font-medium">{doc.party.name}</p>
            {doc.party.phone ? (
              <p className="text-xs" dir="ltr">
                {doc.party.phone}
              </p>
            ) : null}
            {settings.fields.showPartyAddress && doc.party.address ? (
              <p className="text-xs">{doc.party.address}</p>
            ) : null}
            {settings.fields.showPartyTaxId && doc.party.taxId ? (
              <p className="text-xs">الرقم الضريبي: {doc.party.taxId}</p>
            ) : null}
          </div>
        ) : (
          <div />
        )}
        {doc.meta && doc.meta.length > 0 ? (
          <div
            className={cn("p-3 text-xs", layout === "minimal" ? "px-0" : "rounded-md border")}
            style={layout === "minimal" ? undefined : { borderColor: colors.border }}
          >
            {doc.meta.map((row) => (
              <p key={row.label}>
                <span style={{ color: colors.muted }}>{row.label}: </span>
                {row.value}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    ),
    lines: (
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: colors.tableHeader, color: colors.primary }}>
            <th className="border px-2 py-2 text-start" style={{ borderColor: colors.border }}>
              الصنف
            </th>
            {settings.fields.showSku ? (
              <th className="border px-2 py-2 text-start" style={{ borderColor: colors.border }}>
                الكود
              </th>
            ) : null}
            {settings.fields.showUnit ? (
              <th className="border px-2 py-2 text-end" style={{ borderColor: colors.border }}>
                الوحدة
              </th>
            ) : null}
            <th className="border px-2 py-2 text-end" style={{ borderColor: colors.border }}>
              الكمية
            </th>
            {hideMoney ? null : (
              <th className="border px-2 py-2 text-end" style={{ borderColor: colors.border }}>
                السعر
              </th>
            )}
            {!hideMoney && settings.fields.showLineDiscount ? (
              <th className="border px-2 py-2 text-end" style={{ borderColor: colors.border }}>
                الخصم
              </th>
            ) : null}
            {hideMoney ? null : (
              <th className="border px-2 py-2 text-end" style={{ borderColor: colors.border }}>
                الإجمالي
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, index) => (
            <tr
              key={line.id}
              style={
                striped && index % 2 === 1 ? { background: colors.tableHeader } : undefined
              }
            >
              <td className="border px-2 py-1.5" style={{ borderColor: colors.border }}>
                {line.name}
              </td>
              {settings.fields.showSku ? (
                <td className="border px-2 py-1.5 font-mono text-xs" style={{ borderColor: colors.border }}>
                  {line.sku || "—"}
                </td>
              ) : null}
              {settings.fields.showUnit ? (
                <td className="border px-2 py-1.5 text-end" style={{ borderColor: colors.border }}>
                  {line.unit || "—"}
                </td>
              ) : null}
              <td className="border px-2 py-1.5 text-end" style={{ borderColor: colors.border }}>
                {line.quantity}
              </td>
              {hideMoney ? null : (
                <td className="border px-2 py-1.5 text-end" style={{ borderColor: colors.border }}>
                  {formatCurrency(line.unitPrice, currency)}
                </td>
              )}
              {!hideMoney && settings.fields.showLineDiscount ? (
                <td className="border px-2 py-1.5 text-end" style={{ borderColor: colors.border }}>
                  {line.discount ? formatCurrency(line.discount, currency) : "—"}
                </td>
              ) : null}
              {hideMoney ? null : (
                <td className="border px-2 py-1.5 text-end font-medium" style={{ borderColor: colors.border }}>
                  {formatCurrency(line.lineTotal, currency)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    totals: hideMoney ? null : (
      <div className="mb-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <p className="flex justify-between">
            <span style={{ color: colors.muted }}>الإجمالي الفرعي</span>
            <span>{formatCurrency(doc.subtotal, currency)}</span>
          </p>
          {doc.discount > 0 ? (
            <p className="flex justify-between">
              <span style={{ color: colors.muted }}>الخصم</span>
              <span>-{formatCurrency(doc.discount, currency)}</span>
            </p>
          ) : null}
          {extraCost > 0 ? (
            <p className="flex justify-between">
              <span style={{ color: colors.muted }}>تكلفة إضافية</span>
              <span>{formatCurrency(extraCost, currency)}</span>
            </p>
          ) : null}
          {settings.fields.showTaxBreakdown && doc.tax > 0 ? (
            <p className="flex justify-between">
              <span style={{ color: colors.muted }}>الضريبة</span>
              <span>{formatCurrency(doc.tax, currency)}</span>
            </p>
          ) : null}
          <p
            className="flex justify-between border-t pt-2 text-base font-bold"
            style={{ borderColor: colors.primary, color: colors.primary }}
          >
            <span>الإجمالي</span>
            <span>{formatCurrency(doc.total, currency)}</span>
          </p>
          {settings.fields.showAmountInWords ? (
            <p className="pt-1 text-xs" style={{ color: colors.muted }}>
              {amountInArabicWords(doc.total)}
            </p>
          ) : null}
        </div>
      </div>
    ),
    notes:
      settings.fields.showNotes && (doc.notes || (!hideMoney && settings.company.bankDetails)) ? (
        <section className="mb-6 text-xs" style={{ color: colors.muted }}>
          {doc.notes ? <p className="whitespace-pre-wrap">{doc.notes}</p> : null}
          {!hideMoney && settings.company.bankDetails ? (
            <p className="mt-2 whitespace-pre-wrap">التحويل: {settings.company.bankDetails}</p>
          ) : null}
        </section>
      ) : null,
    signature: settings.fields.showSignature ? (
      <div className="mb-6 grid grid-cols-2 gap-8 text-center text-xs" style={{ color: colors.muted }}>
        <div>
          <div className="mb-10 border-b" style={{ borderColor: colors.border }} />
          توقيع المستلم
        </div>
        <div>
          <div className="mb-10 border-b" style={{ borderColor: colors.border }} />
          الختم / التوقيع
        </div>
      </div>
    ) : null,
    qr:
      settings.fields.showQr && qrDataUrl ? (
        <div className="mb-4 flex justify-end">
          <Image src={qrDataUrl} alt={doc.number} width={96} height={96} unoptimized />
        </div>
      ) : null,
    footer: (
      <>
        {footerNote ? (
          <p className="text-center text-xs whitespace-pre-wrap" style={{ color: colors.muted }}>
            {footerNote}
          </p>
        ) : null}
        <p className="mt-4 text-center text-[10px]" style={{ color: colors.muted }}>
          {generatedBy} · {generatedAt}
        </p>
      </>
    ),
  };

  return (
    <div
      data-print-root
      className={cn(
        "relative mx-auto bg-white text-sm",
        compact ? "max-w-[210mm] p-5" : "max-w-[210mm] p-8",
        boxed && "border-2"
      )}
      style={{ color: colors.text, borderColor: boxed ? colors.primary : undefined }}
    >
      {watermarkText ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black opacity-10"
          style={{ color: colors.primary }}
        >
          {watermarkText}
        </div>
      ) : null}

      {blocks.map((block) =>
        block.enabled ? <div key={block.id}>{sections[block.id]}</div> : null
      )}
    </div>
  );
}
