/**
 * Phase 3 / S10 — manager override & money-path audit action registry.
 * Do not invent actions; this documents what production paths must write.
 */
export const PHASE3_REQUIRED_AUDIT_ACTIONS = [
  "pos.manager_override.discount",
  "pos.manager_override.expired_session",
  "pos.manager_override.cash_drawer_open",
  "session.force_closed",
  "order.refunded",
  "order.voided",
] as const;

export type Phase3RequiredAuditAction = (typeof PHASE3_REQUIRED_AUDIT_ACTIONS)[number];

export function isPhase3RequiredAuditAction(action: string): action is Phase3RequiredAuditAction {
  return (PHASE3_REQUIRED_AUDIT_ACTIONS as readonly string[]).includes(action);
}
