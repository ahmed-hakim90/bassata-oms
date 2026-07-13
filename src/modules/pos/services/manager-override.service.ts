export function requiresManagerDiscountOverride(
  discountAmount: number,
  threshold: number | null
) {
  return threshold !== null && discountAmount > threshold;
}

export {
  PHASE3_REQUIRED_AUDIT_ACTIONS,
  isPhase3RequiredAuditAction,
} from "@/modules/pos/services/manager-override-audit";
