/** Purchase import (containers / customs) — domain constants. */

export const PURCHASE_CONTAINER_STATUSES = [
  "planned",
  "shipped",
  "at_port",
  "inland",
  "received",
  "cancelled",
] as const;

export type PurchaseContainerStatus = (typeof PURCHASE_CONTAINER_STATUSES)[number];

export const PURCHASE_CONTAINER_STATUS_LABELS: Record<PurchaseContainerStatus, string> = {
  planned: "مخططة",
  shipped: "اتشحنت",
  at_port: "في المينا",
  inland: "في الطريق للمخزن",
  received: "مستلمة",
  cancelled: "ملغاة",
};

export const CUSTOMS_CERTIFICATE_STATUSES = ["open", "closed"] as const;
export type CustomsCertificateStatus = (typeof CUSTOMS_CERTIFICATE_STATUSES)[number];

export const CUSTOMS_CERTIFICATE_STATUS_LABELS: Record<CustomsCertificateStatus, string> = {
  open: "مفتوحة",
  closed: "مقفولة",
};

export const CUSTOMS_CERTIFICATE_COST_TYPES = [
  "customs",
  "port",
  "demurrage",
  "inland",
  "agent",
  "other",
] as const;

export type CustomsCertificateCostType = (typeof CUSTOMS_CERTIFICATE_COST_TYPES)[number];

export const CUSTOMS_CERTIFICATE_COST_TYPE_LABELS: Record<CustomsCertificateCostType, string> = {
  customs: "جمارك",
  port: "مصاريف مينا",
  demurrage: "أرضيات",
  inland: "نقل داخلي",
  agent: "مخلص",
  other: "أخرى",
};

export const IMPORT_DOCUMENT_CURRENCIES = ["USD", "EUR", "EGP"] as const;
export type ImportDocumentCurrency = (typeof IMPORT_DOCUMENT_CURRENCIES)[number];
