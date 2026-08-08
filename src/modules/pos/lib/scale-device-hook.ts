/**
 * Reference scale hook for supermarket POS terminals.
 *
 * First release: `manual` protocol only (operator enters weight).
 * USB/serial adapters can plug in behind `readWeightFromScale` once a
 * reference device is documented in ops runbooks — do not claim multi-protocol support.
 */

export type ScaleProtocol = "manual" | "usb_serial_stub";

export type ScaleDeviceConfig = {
  enabled: boolean;
  protocol: ScaleProtocol;
  unit: "kg" | "g";
};

export function parseScaleSettings(
  scaleEnabled: boolean | undefined,
  settings: Record<string, unknown> | undefined | null
): ScaleDeviceConfig {
  const protocol =
    settings?.protocol === "usb_serial_stub" ? "usb_serial_stub" : "manual";
  const unit = settings?.unit === "g" ? "g" : "kg";
  return {
    enabled: Boolean(scaleEnabled),
    protocol,
    unit,
  };
}

/**
 * Attempt to read a weight from the configured scale.
 * Returns null when the operator must enter weight manually.
 */
export async function readWeightFromScale(
  config: ScaleDeviceConfig
): Promise<number | null> {
  if (!config.enabled) return null;
  if (config.protocol === "manual") return null;

  // Stub for a single future reference USB/serial bridge (Web Serial).
  // Fail closed to manual entry until a device is certified in the runbook.
  if (typeof navigator === "undefined" || !("serial" in navigator)) {
    return null;
  }
  return null;
}
