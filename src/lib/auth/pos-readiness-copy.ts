export type PosReadinessState =
  | "login_required"
  | "no_device"
  | "device_inactive"
  | "store_mismatch"
  | "store_required"
  | "access_denied"
  | "role_denied"
  | "no_session"
  | "session_warning"
  | "session_expired"
  | "ready";

export const POS_READINESS_COPY: Record<
  PosReadinessState,
  { title: string; description: string; href?: string; cta?: string }
> = {
  login_required: {
    title: "Sign in required",
    description: "Sign in with your cashier, manager, or owner account.",
    href: "/login",
    cta: "Sign in",
  },
  no_device: {
    title: "Device not registered",
    description: "Pair this terminal with a code from Settings or register this browser.",
    href: "/device/pair",
    cta: "Pair device",
  },
  device_inactive: {
    title: "Device inactive",
    description: "This register was disabled. Ask a manager to reactivate it in Settings.",
  },
  store_mismatch: {
    title: "Wrong store",
    description: "This device is registered to another branch. Switch store or pair again.",
    href: "/pos/start",
    cta: "Select store",
  },
  store_required: {
    title: "Select store",
    description: "Choose which branch you are working at.",
    href: "/pos/start",
    cta: "Select store",
  },
  access_denied: {
    title: "Access denied",
    description: "You are not allowed to use POS on this store or device.",
  },
  role_denied: {
    title: "POS not available",
    description: "Your role cannot use the register.",
  },
  no_session: {
    title: "No active session",
    description: "Open your cashier session before selling.",
    href: "/sessions",
    cta: "Open session",
  },
  session_warning: {
    title: "Shift ending soon",
    description: "This session is approaching the maximum open duration. Close the shift soon.",
    href: "/sessions",
    cta: "Close shift",
  },
  session_expired: {
    title: "Close shift to continue",
    description:
      "This session exceeded the allowed open duration. Sales are blocked until you close the shift.",
    href: "/sessions",
    cta: "Close shift",
  },
  ready: {
    title: "Ready",
    description: "You can sell on this register.",
  },
};
