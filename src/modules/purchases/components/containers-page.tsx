"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Ship } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { formatCurrency } from "@/lib/format";
import {
  attachContainerCertificateAction,
  createContainerAction,
  listCertificatesAction,
  receiveContainerAction,
  updateContainerStatusAction,
} from "@/modules/purchases/actions/purchase-import.actions";
import type { ContainerWithLines } from "@/modules/purchases/services/purchase-container.service";
import type { CertificateWithDetails } from "@/modules/purchases/services/customs-certificate.service";
import {
  PURCHASE_CONTAINER_STATUS_LABELS,
  type PurchaseContainerStatus,
} from "@/modules/purchases/lib/import-constants";

const statusVariant: Record<
  PurchaseContainerStatus,
  "draft" | "info" | "warning" | "success" | "danger"
> = {
  planned: "draft",
  shipped: "info",
  at_port: "warning",
  inland: "warning",
  received: "success",
  cancelled: "danger",
};

interface ContainersPageProps {
  containers: ContainerWithLines[];
  currency: string;
}

export function ContainersPage({ containers: initial, currency }: ContainersPageProps) {
  const [containers, setContainers] = useState(initial);
  const [certificates, setCertificates] = useState<CertificateWithDetails[]>([]);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      const result = await listCertificatesAction();
      if (result.ok) {
        setCertificates(result.data.filter((c) => c.status === "open"));
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return containers;
    return containers.filter(
      (c) =>
        c.container_number.toLowerCase().includes(q) ||
        c.purchaseOrderNumber.toLowerCase().includes(q) ||
        (c.certificateNumber ?? "").toLowerCase().includes(q)
    );
  }, [containers, filter]);

  function advance(containerId: string, status: PurchaseContainerStatus) {
    startTransition(async () => {
      const result = await updateContainerStatusAction({ containerId, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data : c))
      );
      toast.success("تم تحديث حالة الحاوية");
    });
  }

  function receive(containerId: string) {
    startTransition(async () => {
      const result = await receiveContainerAction({ containerId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data.container : c))
      );
      toast.success(
        `اتاستلمت الحاوية — فاتورة ${result.data.purchase.invoice_number} · ${formatCurrency(result.data.purchase.total, currency)}`
      );
    });
  }

  function attachCert(containerId: string, certificateId: string | null) {
    startTransition(async () => {
      const result = await attachContainerCertificateAction({
        containerId,
        certificateId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContainers((prev) =>
        prev.map((c) => (c.id === containerId ? result.data : c))
      );
      toast.success(certificateId ? "اتربطت بالشهادة" : "اتشالت من الشهادة");
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الحاويات"
        description="حاويات أمر التوريد من الشحن لحد استلام المخزن"
      />
      <div className="max-w-md">
        <Label htmlFor="container-search">بحث</Label>
        <Input
          id="container-search"
          className="mt-1.5 min-h-11"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="رقم حاوية / أمر / شهادة"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyStateBlock
          title="مفيش حاويات"
          description="أنشئ حاوية من داخل أمر التوريد بعد تفعيل استيراد الحاويات"
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((container) => (
            <OperationalCard
              key={container.id}
              title={container.container_number}
              description={`أمر ${container.purchaseOrderNumber}${
                container.certificateNumber
                  ? ` · شهادة ${container.certificateNumber}`
                  : ""
              }`}
              action={
                <StatusPill
                  label={PURCHASE_CONTAINER_STATUS_LABELS[container.status]}
                  variant={statusVariant[container.status]}
                />
              }
            >
              <p className="text-sm text-muted-foreground">
                {container.lines.length} أصناف · كمية{" "}
                {container.lines.reduce((s, l) => s + l.quantity, 0)}
              </p>
              {container.status !== "cancelled" && certificates.length > 0 ? (
                <div className="mt-3 max-w-sm space-y-1.5">
                  <Label>الشهادة الجمركية</Label>
                  <Select
                    value={container.customs_certificate_id ?? "__none__"}
                    onValueChange={(v) =>
                      attachCert(container.id, !v || v === "__none__" ? null : v)
                    }
                  >
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue>
                        {(value) =>
                          value === "__none__"
                            ? "بدون"
                            : certificates.find((c) => c.id === value)
                                ?.certificate_number ?? "بدون"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" label="بدون">
                        بدون
                      </SelectItem>
                      {certificates.map((cert) => (
                        <SelectItem
                          key={cert.id}
                          value={cert.id}
                          label={cert.certificate_number}
                        >
                          {cert.certificate_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {container.status !== "received" && container.status !== "cancelled" ? (
                <CompactActions className="mt-3">
                  {container.status === "planned" ? (
                    <CompactAction
                      label="اتشحنت"
                      icon={Ship}
                      disabled={pending}
                      onClick={() => advance(container.id, "shipped")}
                    />
                  ) : null}
                  {container.status === "shipped" ? (
                    <CompactAction
                      label="وصلت المينا"
                      icon={Ship}
                      disabled={pending}
                      onClick={() => advance(container.id, "at_port")}
                    />
                  ) : null}
                  {container.status === "at_port" ? (
                    <CompactAction
                      label="في الطريق للمخزن"
                      icon={Ship}
                      disabled={pending}
                      onClick={() => advance(container.id, "inland")}
                    />
                  ) : null}
                  {(container.status === "inland" ||
                    container.status === "at_port" ||
                    container.status === "shipped") && (
                    <CompactAction
                      label="استلام للمخزن"
                      icon={Plus}
                      variant="default"
                      disabled={pending}
                      onClick={() => receive(container.id)}
                    />
                  )}
                </CompactActions>
              ) : null}
            </OperationalCard>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact create form used from purchase order detail. */
export function CreateContainerInline({
  purchaseOrderId,
  lines,
  onCreated,
}: {
  purchaseOrderId: string;
  lines: { sourceLineId: string; productName: string; remaining: number }[];
  onCreated: (container: ContainerWithLines) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [l.sourceLineId, l.remaining > 0 ? String(l.remaining) : ""])
    )
  );

  function submit() {
    startTransition(async () => {
      const payload = lines
        .map((line) => ({
          sourceLineId: line.sourceLineId,
          quantity: parseFloat(qtys[line.sourceLineId] || "0") || 0,
        }))
        .filter((l) => l.quantity > 0);
      const result = await createContainerAction({
        purchaseOrderId,
        containerNumber: number,
        lines: payload,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("اتعملت الحاوية");
      setNumber("");
      onCreated(result.data);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3">
      <div className="space-y-1.5">
        <Label>رقم الحاوية</Label>
        <Input
          className="min-h-11"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="MSKU1234567"
        />
      </div>
      {lines.map((line) => (
        <div key={line.sourceLineId} className="grid grid-cols-[1fr_7rem] items-end gap-2">
          <div>
            <p className="text-sm font-medium">{line.productName}</p>
            <p className="text-xs text-muted-foreground">متبقي {line.remaining}</p>
          </div>
          <Input
            className="min-h-11"
            inputMode="decimal"
            value={qtys[line.sourceLineId] ?? ""}
            onChange={(e) =>
              setQtys((prev) => ({ ...prev, [line.sourceLineId]: e.target.value }))
            }
            disabled={line.remaining <= 0}
          />
        </div>
      ))}
      <Button
        type="button"
        disabled={pending || !number.trim()}
        onClick={submit}
        className="min-h-11 w-full"
      >
        إضافة حاوية
      </Button>
    </div>
  );
}
