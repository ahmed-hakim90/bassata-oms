export type PosReadinessState =
  | "login_required"
  | "no_device"
  | "device_inactive"
  | "store_mismatch"
  | "store_required"
  | "access_denied"
  | "cashier_required"
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
    description:
      "This browser/domain is not paired as a POS device. Pair once from Settings → Devices, then keep using the same URL on this register.",
    href: "/device/pair",
    cta: "Pair device",
  },
  device_inactive: {
    title: "Device inactive",
    description:
      "This register exists but is disabled or missing. Ask a manager to reactivate it in Settings → Devices.",
  },
  store_mismatch: {
    title: "Wrong store",
    description:
      "This browser is paired to a different branch than the active store. Select that branch or pair this browser again for the current branch.",
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
    description:
      "Your user is not allowed to use POS on this store or device. Ask a manager to review store and device access.",
  },
  cashier_required: {
    title: "Cashier PIN required",
    description: "Enter cashier PIN on this device before selling.",
  },
  role_denied: {
    title: "POS not available",
    description: "Your role cannot use the register. Sign in as owner, manager, or cashier.",
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
