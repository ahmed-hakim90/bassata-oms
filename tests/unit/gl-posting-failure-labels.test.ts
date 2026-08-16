import { describe, expect, it } from "vitest";
import {
  GL_POSTING_FAILED_ACTION,
  glPostingFailureLabelAr,
} from "@/modules/accounting/lib/gl-posting-failure-labels";

describe("gl-posting-failure-labels", () => {
  it("keeps a stable audit action key", () => {
    expect(GL_POSTING_FAILED_ACTION).toBe("gl.posting_failed");
  });

  it("maps known labels to Arabic", () => {
    expect(glPostingFailureLabelAr("postSaleJournal")).toBe("ترحيل بيع");
    expect(glPostingFailureLabelAr("postCreditNoteJournal")).toBe("ترحيل إشعار دائن");
    expect(glPostingFailureLabelAr("postPurchaseReturnJournal")).toBe(
      "ترحيل مرتجع مشتريات"
    );
    expect(glPostingFailureLabelAr("postStockCountJournal")).toBe("ترحيل فروقات جرد");
    expect(glPostingFailureLabelAr("unknown_label")).toBe("unknown_label");
  });
});
