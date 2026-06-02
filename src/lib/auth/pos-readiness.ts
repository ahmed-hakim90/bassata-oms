import { getCurrentUser } from "@/lib/auth/session";
import { PosAccessError, resolvePosAccess } from "@/lib/auth/pos-access";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";

export type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
export { POS_READINESS_COPY } from "@/lib/auth/pos-readiness-copy";

export interface PosReadiness {
  state: PosReadinessState;
  storeId: string | null;
  cashierId: string | null;
  deviceId: string | null;
  sessionId: string | null;
}

function mapPosAccessError(code: PosAccessError["code"]): PosReadinessState {
  switch (code) {
    case "login_required":
      return "login_required";
    case "no_device":
      return "no_device";
    case "device_inactive":
      return "device_inactive";
    case "store_mismatch":
      return "store_mismatch";
    case "store_required":
      return "store_required";
    case "access_denied":
      return "access_denied";
    case "cashier_required":
      return "cashier_required";
    case "role_denied":
      return "role_denied";
    default:
      return "access_denied";
  }
}

export async function getPosReadiness(): Promise<PosReadiness> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      state: "login_required",
      storeId: null,
      cashierId: null,
      deviceId: null,
      sessionId: null,
    };
  }

  let ctx;
  try {
    ctx = await resolvePosAccess();
  } catch (e) {
    if (e instanceof PosAccessError) {
      return {
        state: mapPosAccessError(e.code),
        storeId: null,
        cashierId: null,
        deviceId: null,
        sessionId: null,
      };
    }
    throw e;
  }

  const session = await getActiveSession(ctx.storeId, ctx.activeCashierId);
  if (!session) {
    return {
      state: "no_session",
      storeId: ctx.storeId,
      cashierId: ctx.activeCashierId,
      deviceId: ctx.deviceId,
      sessionId: null,
    };
  }

  const settings = await getSessionSettings();
  const lifecycle = computeSessionLifecycle(session, settings);

  if (lifecycle.blocksSales) {
    return {
      state: "session_expired",
      storeId: ctx.storeId,
      cashierId: ctx.activeCashierId,
      deviceId: ctx.deviceId,
      sessionId: session.id,
    };
  }

  if (lifecycle.lifecycle === "warning") {
    return {
      state: "session_warning",
      storeId: ctx.storeId,
      cashierId: ctx.activeCashierId,
      deviceId: ctx.deviceId,
      sessionId: session.id,
    };
  }

  return {
    state: "ready",
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    deviceId: ctx.deviceId,
    sessionId: session.id,
  };
}
