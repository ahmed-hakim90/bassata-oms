import Link from "next/link";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import {
  getActiveCashierId,
  getActiveStoreId,
  getCurrentUser,
  getRegisteredDeviceContext,
} from "@/lib/auth/session";
import { requireStoreAccess } from "@/lib/auth/guards";

export async function SessionBar() {
  const storeId = await getActiveStoreId();
  if (!storeId) return null;

  try {
    await requireStoreAccess(storeId);
  } catch {
    return null;
  }

  const [user, deviceCtx] = await Promise.all([
    getCurrentUser(),
    getRegisteredDeviceContext(),
  ]);

  const cashierId =
    user && deviceCtx?.storeId === storeId
      ? await getActiveCashierId(storeId, deviceCtx.deviceId, user)
      : null;

  const [session, store, cashier, device] = await Promise.all([
    cashierId ? getActiveSession(storeId, cashierId) : Promise.resolve(null),
    storeRepo.getStore(storeId),
    cashierId ? userRepo.getUser(cashierId) : Promise.resolve(null),
    deviceCtx?.deviceId
      ? deviceRepo.getDevice(deviceCtx.deviceId)
      : Promise.resolve(null),
  ]);

  if (!session) return null;

  const openedLabel = new Date(session.opened_at).toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="shrink-0 border-b border-[color-mix(in_srgb,var(--mds-color-feedback-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--mds-color-feedback-success)_8%,var(--mds-color-bg-surface))] px-3 py-1 md:px-[var(--mds-space-4)] dark:bg-[color-mix(in_srgb,var(--mds-color-feedback-success)_10%,transparent)]">
      <Link
        href="/sessions"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] leading-tight hover:underline md:text-xs"
      >
        {/* pulsing active indicator */}
        <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--mds-color-feedback-success)] opacity-40" />
          <span className="inline-flex size-2 rounded-full bg-[var(--mds-color-feedback-success)]" />
        </span>
        <span className="font-semibold text-foreground">{store?.name}</span>
        {device ? (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">{device.name}</span>
          </>
        ) : null}
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[var(--mds-color-feedback-success)]">
          جلسة مفتوحة — {cashier?.name ?? "الكاشير"}
          {cashierId && user && cashierId !== user.id ? " (تم التبديل)" : ""}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="tabular-nums text-muted-foreground">من {openedLabel}</span>
      </Link>
    </div>
  );
}
