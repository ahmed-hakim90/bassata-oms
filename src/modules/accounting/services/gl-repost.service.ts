import * as auditRepo from "@/lib/repositories/audit.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as customerAccountRepo from "@/lib/repositories/customer-account.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as importRepo from "@/lib/repositories/purchase-import.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as stockCountRepo from "@/lib/repositories/stock-count.repository";
import * as supplierPaymentRepo from "@/lib/repositories/supplier-payment.repository";
import * as wasteRepo from "@/lib/repositories/waste.repository";
import { glSaleDiscount } from "@/lib/line-discount";
import { roundMoney } from "@/lib/money";
import { GL_POSTING_FAILED_ACTION } from "@/modules/accounting/lib/gl-posting-failure-labels";
import {
  postCogsAdjustmentJournal,
  postCreditNoteJournal,
  postCustomsCertificateJournal,
  postCustomerPaymentJournal,
  postExpenseJournal,
  postPurchaseJournal,
  postPurchaseReturnJournal,
  postSaleJournal,
  postSaleReversalJournal,
  postSessionVarianceJournal,
  postStockCountJournal,
  postSupplierPaymentJournal,
  postWasteJournal,
  reversePostedBySource,
} from "@/modules/accounting/services/gl-posting.service";
import type { JournalSource, PaymentMethod } from "@/lib/types";

async function saleSnapshot(orderId: string) {
  const order = await orderRepo.getOrder(orderId);
  if (!order) throw new Error("الطلب غير موجود");
  const [payments, items] = await Promise.all([
    orderRepo.getOrderPayments(orderId),
    orderRepo.getOrderItems(orderId),
  ]);
  const glPayments =
    payments.length > 0
      ? payments.map((payment) => ({ method: payment.method, amount: payment.amount }))
      : [{ method: "cash" as const, amount: order.total }];
  return {
    order,
    items,
    payments: glPayments,
    discount: glSaleDiscount(order.discount, items),
    cogs: roundMoney(
      items.reduce((sum, item) => sum + Number(item.line_cost ?? 0), 0)
    ),
  };
}

function asPaymentMethod(value: string | null | undefined): PaymentMethod {
  if (
    value === "cash" ||
    value === "card" ||
    value === "wallet" ||
    value === "other" ||
    value === "credit"
  ) {
    return value;
  }
  return "cash";
}

function asJournalSource(value: unknown): JournalSource | null {
  if (
    value === "manual" ||
    value === "sale" ||
    value === "expense" ||
    value === "purchase" ||
    value === "customer_payment" ||
    value === "supplier_payment" ||
    value === "refund" ||
    value === "adjustment" ||
    value === "customs_certificate"
  ) {
    return value;
  }
  return null;
}

export async function retryFailedGlPosting(
  auditLogId: string,
  userId: string
): Promise<{ alreadyPosted: boolean }> {
  const log = await auditRepo.getAuditLog(auditLogId);
  if (!log || log.action !== GL_POSTING_FAILED_ACTION) {
    throw new Error("سجل فشل الترحيل غير موجود");
  }

  const label = typeof log.metadata.label === "string" ? log.metadata.label : "";
  const entityId = log.entity_id;
  const posted = await replayLabel(
    label,
    entityId,
    userId,
    log.metadata,
    log.store_id
  );
  return { alreadyPosted: posted === "existing" };
}

async function replayLabel(
  label: string,
  entityId: string,
  userId: string,
  metadata: Record<string, unknown>,
  storeId: string | null
): Promise<"posted" | "existing" | "skipped"> {
  switch (label) {
    case "postSaleJournal": {
      const snap = await saleSnapshot(entityId);
      const result = await postSaleJournal({
        orderId: snap.order.id,
        storeId: snap.order.store_id,
        total: snap.order.total,
        tax: snap.order.tax,
        discount: snap.discount,
        payments: snap.payments,
        cogs: snap.cogs,
        createdBy: userId,
        memo: `بيع ${snap.order.order_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postSaleReversalJournal": {
      const snap = await saleSnapshot(entityId);
      const kind = snap.order.status === "voided" ? "void" : "refund";
      const result = await postSaleReversalJournal({
        orderId: snap.order.id,
        storeId: snap.order.store_id,
        kind,
        total: snap.order.total,
        tax: snap.order.tax,
        discount: snap.discount,
        payments: snap.payments,
        cogs: snap.cogs,
        createdBy: userId,
        memo: kind === "void" ? `إلغاء بيع ${snap.order.order_number}` : `مرتجع بيع ${snap.order.order_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postCreditNoteJournal": {
      const snap = await saleSnapshot(entityId);
      const result = await postCreditNoteJournal({
        creditNoteId: snap.order.id,
        storeId: snap.order.store_id,
        total: snap.order.total,
        tax: snap.order.tax,
        discount: snap.discount,
        cogs: snap.cogs,
        createdBy: userId,
        memo: `إشعار دائن ${snap.order.order_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postCogsAdjustmentJournal": {
      const snap = await saleSnapshot(entityId);
      const result = await postCogsAdjustmentJournal({
        orderId: snap.order.id,
        storeId: snap.order.store_id,
        currentCogs: snap.cogs,
        createdBy: userId,
        memo: `تصحيح تكلفة ${snap.order.order_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postPurchaseJournal": {
      const purchase = await purchaseRepo.getPurchase(entityId);
      if (!purchase) throw new Error("فاتورة الشراء غير موجودة");
      if (purchase.status !== "received") {
        throw new Error("الفاتورة لسه مستلمة عشان تترحّل");
      }
      const payments = purchase.supplier_id
        ? await supplierPaymentRepo.listPaymentsForStore(purchase.store_id, {
            supplierId: purchase.supplier_id,
          })
        : [];
      const receivePays = payments.filter(
        (payment) =>
          !payment.voided_at && payment.reference === purchase.invoice_number
      );
      const amountPaid =
        typeof metadata.amountPaid === "number"
          ? roundMoney(Math.max(0, metadata.amountPaid))
          : roundMoney(
              receivePays.reduce((sum, payment) => sum + payment.amount, 0)
            );
      const paymentMethod =
        typeof metadata.paymentMethod === "string"
          ? asPaymentMethod(metadata.paymentMethod)
          : asPaymentMethod(receivePays[0]?.payment_method);
      const result = await postPurchaseJournal({
        purchaseId: purchase.id,
        storeId: purchase.store_id,
        total: purchase.total,
        amountPaid,
        paymentMethod,
        entryDate: purchase.document_date,
        createdBy: userId,
        memo: `استلام شراء ${purchase.invoice_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postPurchaseReturnJournal": {
      const posted = await purchaseRepo.getPurchase(entityId);
      if (!posted) throw new Error("مرتجع الشراء غير موجود");
      const result = await postPurchaseReturnJournal({
        purchaseReturnId: posted.id,
        storeId: posted.store_id,
        total: posted.total,
        entryDate: posted.document_date,
        createdBy: userId,
        memo: `مرتجع مشتريات ${posted.invoice_number}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postExpenseJournal": {
      const expense = await expenseRepo.getExpense(entityId);
      if (!expense) throw new Error("المصروف غير موجود");
      if (expense.status !== "approved") {
        throw new Error("المصروف مش معتمد");
      }
      const result = await postExpenseJournal({
        expenseId: expense.id,
        storeId: expense.store_id,
        amount: expense.amount,
        paymentMethod: asPaymentMethod(expense.payment_method),
        createdBy: userId,
        memo: expense.title || `مصروف ${expense.id.slice(0, 8)}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postCustomerPaymentJournal": {
      const payment = await customerAccountRepo.getCustomerPayment(entityId);
      if (!payment) throw new Error("تحصيل العميل غير موجود");
      if (payment.voided_at) throw new Error("التحصيل ملغي");
      const result = await postCustomerPaymentJournal({
        paymentId: payment.id,
        storeId: payment.store_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        createdBy: userId,
      });
      return result ? "posted" : "skipped";
    }
    case "postSupplierPaymentJournal": {
      const payment = await supplierPaymentRepo.getSupplierPayment(entityId);
      if (!payment) throw new Error("دفعة المورد غير موجودة");
      if (payment.voided_at) throw new Error("الدفعة ملغاة");
      const result = await postSupplierPaymentJournal({
        paymentId: payment.id,
        storeId: payment.store_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        entryDate: payment.paid_at,
        createdBy: userId,
      });
      return result ? "posted" : "skipped";
    }
    case "postWasteJournal": {
      const record = await wasteRepo.getWaste(entityId);
      if (!record) throw new Error("سجل الهالك غير موجود");
      const product = await catalogRepo.getProduct(record.product_id);
      const cost = roundMoney(
        Math.max(0, Number(product?.last_unit_cost ?? 0)) * Number(record.quantity)
      );
      if (cost <= 0) return "skipped";
      const result = await postWasteJournal({
        wasteId: record.id,
        storeId: record.store_id,
        cost,
        createdBy: userId,
        memo: `هالك ${record.reason_code}`,
      });
      return result ? "posted" : "skipped";
    }
    case "postStockCountJournal": {
      const count = await stockCountRepo.getStockCount(entityId);
      if (!count) throw new Error("الجرد غير موجود");
      if (count.status !== "completed") {
        throw new Error("الجرد لسه مكتمل");
      }
      const lines = await stockCountRepo.getStockCountLines(count.id);
      const products = await catalogRepo.getProductsByIds(
        [...new Set(lines.map((line) => line.product_id))]
      );
      const inventoryDeltaValue = roundMoney(
        lines.reduce((sum, line) => {
          if (line.variance === 0) return sum;
          const unitCost = Math.max(
            0,
            products.get(line.product_id)?.last_unit_cost ?? 0
          );
          return sum + line.variance * unitCost;
        }, 0)
      );
      const result = await postStockCountJournal({
        countId: count.id,
        storeId: count.store_id,
        inventoryDeltaValue,
        createdBy: userId,
        memo: "فروقات جرد",
      });
      return result ? "posted" : "skipped";
    }
    case "postCustomsCertificateJournal": {
      const cost = await importRepo.getCertificateCost(entityId);
      if (!cost) throw new Error("مصروف الشهادة غير موجود");
      const certificate = await importRepo.getCertificate(cost.certificate_id);
      if (!certificate) throw new Error("الشهادة غير موجودة");
      const result = await postCustomsCertificateJournal({
        certificateId: certificate.id,
        costId: cost.id,
        storeId: certificate.store_id,
        amount: cost.amount,
        paymentMethod: cost.payment_method,
        createdBy: userId,
        memo: `شهادة جمركية ${certificate.certificate_number} — رسملة مصروف`,
      });
      return result ? "posted" : "skipped";
    }
    case "postSessionVarianceJournal": {
      const session = await sessionRepo.getSession(entityId);
      if (!session) throw new Error("الوردية غير موجودة");
      if (session.status !== "closed") {
        throw new Error("الوردية لسه مقفولة");
      }
      const result = await postSessionVarianceJournal({
        sessionId: session.id,
        storeId: session.store_id,
        variance: Number(session.variance ?? 0),
        createdBy: userId,
        memo: "فرق إقفال وردية",
      });
      return result ? "posted" : "skipped";
    }
    case "reversePostedBySource": {
      const originalSource = asJournalSource(metadata.originalSource);
      const reverseSource = asJournalSource(metadata.reverseSource);
      const reverseSourceId =
        typeof metadata.reverseSourceId === "string"
          ? metadata.reverseSourceId
          : "";
      if (!originalSource || !reverseSource || !reverseSourceId || !storeId) {
        throw new Error("البيانات ناقصة — أنشئ قيد عكسي يدوي من القيود اليومية");
      }
      const result = await reversePostedBySource({
        originalSource,
        originalSourceId: entityId,
        reverseSource,
        reverseSourceId,
        storeId,
        createdBy: userId,
        memo:
          typeof metadata.memo === "string" ? metadata.memo : "عكس قيد مرحّل",
      });
      return result ? "posted" : "skipped";
    }
    default:
      throw new Error("النوع ده يتعمله قيد يدوي من القيود اليومية");
  }
}
