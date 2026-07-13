"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, MonitorSmartphone, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import {
  createDeviceAction,
  deleteDeviceAction,
  generateDevicePairingCodeAction,
  updateDeviceAction,
} from "@/modules/system/actions/system.actions";
import { registerBrowserDeviceAction } from "@/modules/auth/actions/device.actions";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatRelativeTime } from "@/lib/format";
import type { Device, Store } from "@/lib/types";

interface DevicesManagerProps {
  stores: Store[];
  devices: Device[];
}

interface PairingInfo {
  deviceName: string;
  code: string;
}

const PAIR_PATH = "/device/pair";

export function DevicesManager({ stores, devices }: DevicesManagerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addNames, setAddNames] = useState<Record<string, string>>({});
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [pairUrl] = useState(() =>
    typeof window !== "undefined" ? `${window.location.origin}${PAIR_PATH}` : PAIR_PATH
  );

  function generateCode(device: Device) {
    startTransition(async () => {
      try {
        const { code } = await generateDevicePairingCodeAction(device.id);
        setPairing({ deviceName: device.name, code });
      } catch {
        toast.error(t("Failed to generate code"));
      }
    });
  }

  function addDevice(storeId: string) {
    const name = addNames[storeId]?.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await createDeviceAction({ storeId, name });
        setAddNames((current) => ({ ...current, [storeId]: "" }));
        const { code } = await generateDevicePairingCodeAction(created.id);
        setPairing({ deviceName: created.name, code });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("Failed to create device")
        );
      }
    });
  }

  function toggleActive(device: Device) {
    startTransition(async () => {
      try {
        await updateDeviceAction(device.id, { isActive: !device.is_active });
        router.refresh();
        toast.success(t("Device updated"));
      } catch {
        toast.error(t("Failed to update device"));
      }
    });
  }

  function registerBrowser(device: Device) {
    startTransition(async () => {
      const result = await registerBrowserDeviceAction(device.id);
      if (result.success) {
        router.refresh();
        toast.success(t("This browser is registered"));
      } else {
        toast.error(result.error ?? t("Registration failed"));
      }
    });
  }

  async function copyCode() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      toast.success(t("Pairing code copied"));
    } catch {
      toast.error(t("Copy failed"));
    }
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        title={t("POS Devices")}
        description={t("Register each cashier device once, then pair it with a one-time code")}
      />

      <OperationalCard title={t("How do I connect a new device?")}>
        <ol className="grid gap-[var(--mds-space-2)] text-sm text-muted-foreground sm:grid-cols-3">
          <li className="rounded-[var(--mds-radius-md)] bg-muted/50 p-[var(--mds-space-3)]">
            <span className="mb-[var(--mds-space-1)] block font-semibold text-foreground">1. {t("Add the device")}</span>
            {t("Give it a clear name like \"Front register\" and it gets a pairing code instantly")}
          </li>
          <li className="rounded-[var(--mds-radius-md)] bg-muted/50 p-[var(--mds-space-3)]">
            <span className="mb-[var(--mds-space-1)] block font-semibold text-foreground">2. {t("Open the pairing page")}</span>
            {t("On the cashier device, sign in and open")}{" "}
            <span className="font-mono text-xs" dir="ltr">{pairUrl}</span>
          </li>
          <li className="rounded-[var(--mds-radius-md)] bg-muted/50 p-[var(--mds-space-3)]">
            <span className="mb-[var(--mds-space-1)] block font-semibold text-foreground">3. {t("Enter the code")}</span>
            {t("Type the code on the device. It is valid for 15 minutes")}
          </li>
        </ol>
      </OperationalCard>

      <div className="grid gap-[var(--mds-space-6)]">
        {stores.map((store) => {
          const storeDevices = devices.filter((d) => d.store_id === store.id);
          return (
            <OperationalCard key={store.id} title={store.name}>
              <div className="grid gap-[var(--mds-space-3)]">
                {storeDevices.length === 0 ? (
                  <p className="rounded-[var(--mds-radius-md)] border border-dashed border-border p-[var(--mds-space-4)] text-sm text-muted-foreground">
                    {t("No devices for this branch yet. Add the first one below")}
                  </p>
                ) : (
                  <div className="grid gap-[var(--mds-space-3)] md:grid-cols-2 xl:grid-cols-3">
                    {storeDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex flex-col gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]"
                      >
                        <div className="flex items-start justify-between gap-[var(--mds-space-2)]">
                          <div className="flex min-w-0 items-center gap-[var(--mds-space-2)]">
                            <MonitorSmartphone className="size-5 shrink-0 text-muted-foreground" />
                            <p className="truncate font-medium">{device.name}</p>
                          </div>
                          <StatusPill
                            variant={device.is_active ? (device.last_seen_at ? "success" : "warning") : "danger"}
                            label={
                              device.is_active
                                ? device.last_seen_at
                                  ? t("Paired")
                                  : t("Not paired yet")
                                : t("Disabled")
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {device.last_seen_at
                            ? `${t("Last seen")}: ${formatRelativeTime(device.last_seen_at)}`
                            : t("Waiting for first pairing")}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-[var(--mds-space-2)]">
                          <Button
                            size="sm"
                            className="shadow-[var(--mds-elevation-1)]"
                            disabled={pending || !device.is_active}
                            onClick={() => generateCode(device)}
                          >
                            {t("Pairing code")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--mds-radius-md)]"
                            disabled={pending || !device.is_active}
                            onClick={() => registerBrowser(device)}
                          >
                            {t("Use this browser")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--mds-radius-md)]"
                            disabled={pending}
                            onClick={() => toggleActive(device)}
                          >
                            <Power className="size-3.5" />
                            {device.is_active ? t("Disable") : t("Enable")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-[var(--mds-radius-md)] text-destructive hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeviceToDelete(device)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  className="flex max-w-md gap-[var(--mds-space-2)]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addDevice(store.id);
                  }}
                >
                  <Input
                    placeholder={t("Device name, e.g. Front register")}
                    value={addNames[store.id] ?? ""}
                    onChange={(e) =>
                      setAddNames((current) => ({ ...current, [store.id]: e.target.value }))
                    }
                    className="rounded-[var(--mds-radius-md)]"
                  />
                  <Button
                    type="submit"
                    className="shadow-[var(--mds-elevation-1)]"
                    disabled={pending || !(addNames[store.id]?.trim())}
                  >
                    <Plus className="size-4" />
                    {t("Add device")}
                  </Button>
                </form>
              </div>
            </OperationalCard>
          );
        })}
      </div>

      <Dialog open={pairing !== null} onOpenChange={(open) => !open && setPairing(null)}>
        {pairing ? (
          <StandardModalContent
            title={`${t("Pairing code")} — ${pairing.deviceName}`}
            description={t("Enter this code on the cashier device. Valid for 15 minutes")}
            footer={
              <div className="flex w-full flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={copyCode}>
                  <Copy className="size-4" />
                  {t("Copy code")}
                </Button>
                <Button onClick={() => setPairing(null)}>{t("Done")}</Button>
              </div>
            }
          >
            <p
              className="rounded-[var(--mds-radius-lg)] bg-muted py-[var(--mds-space-6)] text-center font-mono text-5xl font-bold tracking-[0.3em]"
              dir="ltr"
            >
              {pairing.code}
            </p>
            <ol className="list-inside list-decimal space-y-[var(--mds-space-1)] text-sm text-muted-foreground">
              <li>{t("On the cashier device, sign in and open")}{" "}
                <span className="font-mono text-xs" dir="ltr">{pairUrl}</span>
              </li>
              <li>{t("Type the code on the device. It is valid for 15 minutes")}</li>
              <li>{t("The device opens the POS screen automatically after pairing")}</li>
            </ol>
          </StandardModalContent>
        ) : null}
      </Dialog>

      <ConfirmActionDialog
        open={deviceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDeviceToDelete(null);
        }}
        title={t("Delete this device?")}
        description={t("The device will no longer be able to open the POS. This action cannot be undone.")}
        confirmLabel={t("Delete device")}
        destructive
        onConfirm={async () => {
          if (!deviceToDelete) return;
          try {
            await deleteDeviceAction(deviceToDelete.id);
            setDeviceToDelete(null);
            router.refresh();
            toast.success(t("Device deleted"));
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : t("Failed to delete device")
            );
          }
        }}
      />
    </div>
  );
}
