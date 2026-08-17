import { callRpc } from "@/lib/repositories/client";
import { getUser } from "@/lib/repositories/user.repository";

export { requiresManagerDiscountOverride } from "@/modules/pos/lib/requires-manager-discount-override";

export async function assertManagerOverridePin(input: {
  storeId: string;
  deviceId: string;
  pin: string | undefined;
}): Promise<{ managerId: string; managerName: string }> {
  const pin = input.pin?.trim() ?? "";
  if (pin.length < 4) {
    throw new Error("أدخل PIN المالك أو المدير");
  }

  const { data, error } = await callRpc<string>("verify_manager_override_pin", {
    p_store_id: input.storeId,
    p_pin: pin,
    p_device_id: input.deviceId,
  });

  if (error || !data) {
    const message = error?.message ?? "";
    if (message.includes("Too many failed PIN")) {
      throw new Error("محاولات PIN كتيرة. استنى شوية وجرب تاني.");
    }
    if (message.includes("Invalid PIN") || message.includes("Unauthorized")) {
      throw new Error("PIN المدير غلط");
    }
    throw new Error("تعذر التحقق من موافقة المدير");
  }

  const manager = await getUser(data);
  if (!manager || (manager.role !== "owner" && manager.role !== "manager") || !manager.is_active) {
    throw new Error("PIN المدير غلط");
  }
  return { managerId: manager.id, managerName: manager.name };
}

export {
  PHASE3_REQUIRED_AUDIT_ACTIONS,
  isPhase3RequiredAuditAction,
} from "@/modules/pos/services/manager-override-audit";
