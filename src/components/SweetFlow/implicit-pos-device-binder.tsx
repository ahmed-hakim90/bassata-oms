"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { ensureImplicitPosDeviceBindingAction } from "@/modules/auth/actions/device.actions";

const BIND_STATES = new Set<PosReadinessState>([
  "no_device",
  "device_inactive",
  "store_mismatch",
]);

/** Best-effort silent bind from shell chrome when readiness still asks for a device. */
export function ImplicitPosDeviceBinder({ state }: { state: PosReadinessState }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!BIND_STATES.has(state) || started.current) return;
    started.current = true;
    void (async () => {
      const result = await ensureImplicitPosDeviceBindingAction();
      if (result.success) {
        router.refresh();
      }
    })();
  }, [state, router]);

  return null;
}
