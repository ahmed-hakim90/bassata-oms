/** Audit action written when auto GL posting soft-fails. */
export const GL_POSTING_FAILED_ACTION = "gl.posting_failed";

export type GlPostingFailure = {
  id: string;
  createdAt: string;
  entityId: string;
  storeId: string | null;
  label: string;
  source: string;
  error: string;
};

const LABEL_AR: Record<string, string> = {
  postSaleJournal: "ترحيل بيع",
  postExpenseJournal: "ترحيل مصروف",
  postPurchaseJournal: "ترحيل مشتريات",
  postCustomerPaymentJournal: "ترحيل تحصيل عميل",
  postSupplierPaymentJournal: "ترحيل دفعة مورد",
  postSaleReversalJournal: "ترحيل مرتجع / إلغاء",
  postWasteJournal: "ترحيل هالك",
  reversePostedBySource: "عكس قيد مرحّل",
};

export function glPostingFailureLabelAr(label: string): string {
  return LABEL_AR[label] ?? label;
}
