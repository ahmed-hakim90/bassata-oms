import { z } from "zod";

export const PRINT_ENGINE_LAYOUTS = [
  "classic",
  "modern",
  "boxed",
  "striped",
  "compact",
  "minimal",
  "statement",
] as const;
export type PrintEngineLayout = (typeof PRINT_ENGINE_LAYOUTS)[number];

export const PRINT_ENGINE_LAYOUT_LABELS: Record<PrintEngineLayout, string> = {
  classic: "كلاسيكي",
  modern: "حديث",
  boxed: "إطار",
  striped: "مخطط",
  compact: "مضغوط",
  minimal: "بسيط",
  statement: "كشف حساب",
};

export const PRINT_LOGO_POSITIONS = ["start", "center", "end"] as const;
export type PrintLogoPosition = (typeof PRINT_LOGO_POSITIONS)[number];

export const PRINT_LOGO_SIZES = ["sm", "md", "lg"] as const;
export type PrintLogoSize = (typeof PRINT_LOGO_SIZES)[number];

export const PRINT_DOCUMENT_BLOCKS = [
  "header",
  "party",
  "lines",
  "totals",
  "notes",
  "signature",
  "qr",
  "footer",
] as const;
export type PrintDocumentBlockId = (typeof PRINT_DOCUMENT_BLOCKS)[number];

export const PRINT_DOCUMENT_BLOCK_LABELS: Record<PrintDocumentBlockId, string> = {
  header: "الترويسة والعنوان",
  party: "بيانات الطرف",
  lines: "جدول الأصناف",
  totals: "الإجماليات",
  notes: "الملاحظات والتحويل",
  signature: "التوقيع والختم",
  qr: "رمز QR",
  footer: "الذيل",
};

export type PrintDocumentBlock = {
  id: PrintDocumentBlockId;
  enabled: boolean;
};

export const COMMERCIAL_DOCUMENT_KINDS = [
  "sales_invoice",
  "quotation",
  "sales_order",
  "credit_note",
  "pos_a4",
  "delivery_note",
  "purchase_request",
  "purchase_order",
  "purchase_invoice",
  "purchase_return",
] as const;
export type CommercialDocumentKind = (typeof COMMERCIAL_DOCUMENT_KINDS)[number];

export const COMMERCIAL_DOCUMENT_KIND_LABELS: Record<CommercialDocumentKind, string> = {
  sales_invoice: "فاتورة مبيعات",
  quotation: "عرض سعر",
  sales_order: "أمر بيع",
  credit_note: "إشعار دائن",
  pos_a4: "فاتورة كاشير",
  delivery_note: "إذن تسليم",
  purchase_request: "طلب شراء",
  purchase_order: "أمر توريد",
  purchase_invoice: "فاتورة شراء",
  purchase_return: "مرتجع مشتريات",
};

export const MAX_PRINT_TEMPLATES = 8;

const colorsSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  tableHeader: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  muted: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  border: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const documentOverrideSchema = z.object({
  title: z.string().max(80).optional(),
  footerNote: z.string().max(500).optional(),
  showWatermark: z.boolean().optional(),
});

const documentsSchema = z
  .object({
    sales_invoice: documentOverrideSchema.optional(),
    quotation: documentOverrideSchema.optional(),
    sales_order: documentOverrideSchema.optional(),
    credit_note: documentOverrideSchema.optional(),
    pos_a4: documentOverrideSchema.optional(),
    delivery_note: documentOverrideSchema.optional(),
    purchase_request: documentOverrideSchema.optional(),
    purchase_order: documentOverrideSchema.optional(),
    purchase_invoice: documentOverrideSchema.optional(),
    purchase_return: documentOverrideSchema.optional(),
  })
  .partial()
  .optional();

const blocksSchema = z
  .array(
    z.object({
      id: z.enum(PRINT_DOCUMENT_BLOCKS),
      enabled: z.boolean(),
    })
  )
  .max(PRINT_DOCUMENT_BLOCKS.length)
  .optional();

const templateStyleShape = {
  layout: z.enum(PRINT_ENGINE_LAYOUTS),
  colors: colorsSchema,
  logo: z.object({
    show: z.boolean(),
    position: z.enum(PRINT_LOGO_POSITIONS),
    size: z.enum(PRINT_LOGO_SIZES),
  }),
  company: z.object({
    legalName: z.string().max(160),
    taxId: z.string().max(40),
    commercialRegister: z.string().max(40),
    address: z.string().max(240),
    phone: z.string().max(40),
    email: z.string().max(120),
    bankDetails: z.string().max(240),
  }),
  fields: z.object({
    showSku: z.boolean(),
    showUnit: z.boolean(),
    showLineDiscount: z.boolean(),
    showTaxBreakdown: z.boolean(),
    showPartyAddress: z.boolean(),
    showPartyTaxId: z.boolean(),
    showNotes: z.boolean(),
    showAmountInWords: z.boolean(),
    showSignature: z.boolean(),
    showQr: z.boolean(),
  }),
  headerText: z.string().max(500),
  footerText: z.string().max(500),
  documents: documentsSchema,
  blocks: blocksSchema,
};

export const printTemplateSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  name: z.string().min(1).max(60),
  ...templateStyleShape,
});

const assignmentsSchema = z
  .object({
    sales_invoice: z.string().max(40).optional(),
    quotation: z.string().max(40).optional(),
    sales_order: z.string().max(40).optional(),
    credit_note: z.string().max(40).optional(),
    pos_a4: z.string().max(40).optional(),
    delivery_note: z.string().max(40).optional(),
    purchase_request: z.string().max(40).optional(),
    purchase_order: z.string().max(40).optional(),
    purchase_invoice: z.string().max(40).optional(),
    purchase_return: z.string().max(40).optional(),
  })
  .partial()
  .optional();

export const printEngineSettingsSchema = z.object({
  templates: z.array(printTemplateSchema).min(1).max(MAX_PRINT_TEMPLATES),
  defaultTemplateId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  assignments: assignmentsSchema,
});

export type PrintTemplate = z.infer<typeof printTemplateSchema>;
export type PrintTemplateStyle = Omit<PrintTemplate, "id" | "name">;
export type PrintEngineSettings = z.infer<typeof printEngineSettingsSchema>;

export const DEFAULT_PRINT_BLOCKS: PrintDocumentBlock[] = PRINT_DOCUMENT_BLOCKS.map((id) => ({
  id,
  enabled: true,
}));

const DEFAULT_COLORS = {
  primary: "#0e7490",
  accent: "#134e4a",
  tableHeader: "#ecfeff",
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
} as const;

const DEFAULT_COMPANY: PrintTemplate["company"] = {
  legalName: "",
  taxId: "",
  commercialRegister: "",
  address: "",
  phone: "",
  email: "",
  bankDetails: "",
};

const DEFAULT_FIELDS: PrintTemplate["fields"] = {
  showSku: true,
  showUnit: true,
  showLineDiscount: true,
  showTaxBreakdown: true,
  showPartyAddress: true,
  showPartyTaxId: true,
  showNotes: true,
  showAmountInWords: true,
  showSignature: true,
  showQr: false,
};

function styleTemplate(
  id: string,
  name: string,
  layout: PrintEngineLayout,
  colors: PrintTemplate["colors"] = DEFAULT_COLORS
): PrintTemplate {
  return {
    id,
    name,
    layout,
    colors,
    logo: { show: true, position: "start", size: "md" },
    company: { ...DEFAULT_COMPANY },
    fields: { ...DEFAULT_FIELDS },
    headerText: "",
    footerText: "شكرًا لتعاملكم معنا",
    documents: {},
    blocks: DEFAULT_PRINT_BLOCKS.map((block) => ({ ...block })),
  };
}

export const DEFAULT_PRINT_TEMPLATES: PrintTemplate[] = [
  styleTemplate("classic", "كلاسيكي", "classic"),
  styleTemplate("modern", "حديث", "modern", {
    primary: "#0f172a",
    accent: "#0e7490",
    tableHeader: "#f1f5f9",
    text: "#0f172a",
    muted: "#64748b",
    border: "#cbd5e1",
  }),
  styleTemplate("boxed", "إطار", "boxed", {
    primary: "#134e4a",
    accent: "#0e7490",
    tableHeader: "#f0fdfa",
    text: "#134e4a",
    muted: "#5b716e",
    border: "#134e4a",
  }),
];

export const DEFAULT_PRINT_ENGINE_SETTINGS: PrintEngineSettings = {
  templates: DEFAULT_PRINT_TEMPLATES,
  defaultTemplateId: "classic",
  assignments: {},
};

export function normalizePrintBlocks(
  blocks?: PrintDocumentBlock[] | null
): PrintDocumentBlock[] {
  const seen = new Set<PrintDocumentBlockId>();
  const ordered: PrintDocumentBlock[] = [];
  for (const block of blocks ?? []) {
    if (!PRINT_DOCUMENT_BLOCKS.includes(block.id) || seen.has(block.id)) continue;
    seen.add(block.id);
    ordered.push({ id: block.id, enabled: block.enabled !== false });
  }
  for (const id of PRINT_DOCUMENT_BLOCKS) {
    if (!seen.has(id)) ordered.push({ id, enabled: true });
  }
  return ordered;
}

export function newPrintTemplateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tpl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `tpl_${Date.now().toString(36)}`;
}

export function duplicatePrintTemplate(
  source: PrintTemplate,
  name: string
): PrintTemplate {
  return {
    ...structuredClone(source),
    id: newPrintTemplateId(),
    name: name.trim().slice(0, 60) || `نسخة من ${source.name}`.slice(0, 60),
    blocks: normalizePrintBlocks(source.blocks),
  };
}

export function resolvePrintTemplate(
  settings: PrintEngineSettings,
  kind?: CommercialDocumentKind
): PrintTemplate {
  const assigned = kind ? settings.assignments?.[kind] : undefined;
  const preferred = assigned || settings.defaultTemplateId;
  return (
    settings.templates.find((template) => template.id === preferred) ??
    settings.templates.find((template) => template.id === settings.defaultTemplateId) ??
    settings.templates[0] ??
    DEFAULT_PRINT_TEMPLATES[0]
  );
}

function isCatalogPayload(value: unknown): value is { templates: unknown } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { templates?: unknown }).templates));
}

function coerceCatalog(settings: PrintEngineSettings): PrintEngineSettings {
  const templates = settings.templates.slice(0, MAX_PRINT_TEMPLATES).map((template) => ({
    ...template,
    blocks: normalizePrintBlocks(template.blocks),
  }));
  const defaultTemplateId =
    templates.some((template) => template.id === settings.defaultTemplateId)
      ? settings.defaultTemplateId
      : templates[0]?.id ?? "classic";
  const assignments: PrintEngineSettings["assignments"] = {};
  for (const kind of COMMERCIAL_DOCUMENT_KINDS) {
    const assigned = settings.assignments?.[kind];
    if (assigned && templates.some((template) => template.id === assigned)) {
      assignments[kind] = assigned;
    }
  }
  return { templates, defaultTemplateId, assignments };
}

function wrapLegacyStyle(style: PrintTemplateStyle, name = "القالب الأساسي"): PrintEngineSettings {
  return {
    templates: [
      {
        id: "default",
        name,
        ...style,
        blocks: normalizePrintBlocks(style.blocks),
      },
    ],
    defaultTemplateId: "default",
    assignments: {},
  };
}

function parseLegacyStyle(value: unknown): PrintTemplateStyle {
  const loose = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const base = DEFAULT_PRINT_TEMPLATES[0];
  const parsed = z.object(templateStyleShape).partial().safeParse(loose);
  const data = parsed.success ? parsed.data : {};
  return {
    layout:
      PRINT_ENGINE_LAYOUTS.find((layout) => layout === data.layout || layout === loose.layout) ??
      base.layout,
    colors: { ...base.colors, ...(data.colors ?? {}) },
    logo: { ...base.logo, ...(data.logo ?? {}) },
    company: { ...base.company, ...(data.company ?? {}) },
    fields: { ...base.fields, ...(data.fields ?? {}) },
    headerText:
      typeof data.headerText === "string"
        ? data.headerText
        : typeof loose.headerText === "string"
          ? loose.headerText
          : base.headerText,
    footerText:
      typeof data.footerText === "string"
        ? data.footerText
        : typeof loose.footerText === "string"
          ? loose.footerText
          : base.footerText,
    documents: data.documents ?? {},
    blocks: normalizePrintBlocks(data.blocks),
  };
}

export function parsePrintEngineSettings(value: unknown): PrintEngineSettings {
  if (isCatalogPayload(value)) {
    const parsed = printEngineSettingsSchema.safeParse(value);
    if (parsed.success) return coerceCatalog(parsed.data);
    return DEFAULT_PRINT_ENGINE_SETTINGS;
  }
  if (value && typeof value === "object") {
    return wrapLegacyStyle(parseLegacyStyle(value));
  }
  return DEFAULT_PRINT_ENGINE_SETTINGS;
}

export function documentTitle(
  settings: PrintTemplateStyle | PrintTemplate,
  kind: CommercialDocumentKind
): string {
  return settings.documents?.[kind]?.title?.trim() || COMMERCIAL_DOCUMENT_KIND_LABELS[kind];
}
