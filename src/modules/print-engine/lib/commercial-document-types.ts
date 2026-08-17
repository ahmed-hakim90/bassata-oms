import type { ReportBranding } from "@/modules/reports/core/report-context";
import type {
  CommercialDocumentKind,
  PrintTemplate,
  PrintTemplateStyle,
} from "@/modules/print-engine/lib/print-engine-settings";

export interface CommercialParty {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
}

export interface CommercialDocumentLine {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  lineTotal: number;
}

export interface CommercialDocumentData {
  kind: CommercialDocumentKind;
  number: string;
  dateLabel: string;
  validUntil?: string | null;
  notes?: string | null;
  watermark?: string | null;
  partyLabel: string;
  party: CommercialParty | null;
  meta?: Array<{ label: string; value: string }>;
  lines: CommercialDocumentLine[];
  subtotal: number;
  discount: number;
  tax: number;
  extraCost?: number;
  total: number;
}

export interface CommercialDocumentViewProps {
  branding: ReportBranding;
  settings: PrintTemplateStyle | PrintTemplate;
  document: CommercialDocumentData;
  generatedBy: string;
  generatedAt: string;
  qrDataUrl?: string | null;
  /** Hide unit prices / money columns (e.g. PO or quotation for warehouse). */
  hideMoney?: boolean;
}
