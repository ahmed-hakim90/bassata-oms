import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHASE3_REQUIRED_AUDIT_ACTIONS,
  isPhase3RequiredAuditAction,
} from "@/modules/pos/services/manager-override-audit";

const ROOT = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Phase 3 manager override / money-path audit coverage", () => {
  it("exposes the required audit action registry", () => {
    expect(PHASE3_REQUIRED_AUDIT_ACTIONS).toEqual([
      "pos.manager_override.discount",
      "pos.manager_override.expired_session",
      "pos.manager_override.cash_drawer_open",
      "session.force_closed",
      "order.refunded",
      "order.voided",
    ]);
    expect(isPhase3RequiredAuditAction("pos.manager_override.discount")).toBe(true);
    expect(isPhase3RequiredAuditAction("pos.unknown")).toBe(false);
  });

  it("wires override/refund/force-close audit writers in production paths", () => {
    const checkout = readSrc("src/modules/pos/services/pos-checkout-flow.service.ts");
    const drawer = readSrc("src/modules/pos/actions/cash-drawer.action.ts");
    const session = readSrc("src/modules/sessions/services/session.service.ts");
    const refundRpc = readSrc(
      "supabase/migrations/20260713142010_refund_restock_and_partial_credit_fix.sql"
    );

    expect(checkout).toContain('action: "pos.manager_override.discount"');
    expect(checkout).toContain('action: "pos.manager_override.expired_session"');
    expect(drawer).toContain('action: "pos.manager_override.cash_drawer_open"');
    expect(session).toContain('"session.force_closed"');
    expect(refundRpc).toContain("'order.refunded'");
    expect(refundRpc).toContain("'order.voided'");
  });
});
