"use client";

import { useMemo, useState, useTransition } from "react";
import { FileBadge, Plus } from "lucide-react";
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
  addCertificateCostAction,
  closeCertificateAction,
  createCertificateAction,
} from "@/modules/purchases/actions/purchase-import.actions";
import type { CertificateWithDetails } from "@/modules/purchases/services/customs-certificate.service";
import {
  CUSTOMS_CERTIFICATE_COST_TYPE_LABELS,
  CUSTOMS_CERTIFICATE_COST_TYPES,
  CUSTOMS_CERTIFICATE_STATUS_LABELS,
  type CustomsCertificateCostType,
} from "@/modules/purchases/lib/import-constants";
import { CERTIFICATE_COST_HINT } from "@/modules/purchases/lib/landed-cost-split";
import type { Supplier } from "@/lib/types";

interface CustomsCertificatesPageProps {
  certificates: CertificateWithDetails[];
  suppliers: Supplier[];
  currency: string;
}

export function CustomsCertificatesPage({
  certificates: initial,
  suppliers,
  currency,
}: CustomsCertificatesPageProps) {
  const [certificates, setCertificates] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [newNumber, setNewNumber] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [costType, setCostType] = useState<CustomsCertificateCostType>("customs");
  const [costAmount, setCostAmount] = useState("");
  const [payeeId, setPayeeId] = useState<string>("");

  const selected = useMemo(
    () => certificates.find((c) => c.id === selectedId) ?? null,
    [certificates, selectedId]
  );

  function createCert() {
    startTransition(async () => {
      const result = await createCertificateAction({
        certificateNumber: newNumber,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) => [result.data, ...prev]);
      setSelectedId(result.data.id);
      setNewNumber("");
      toast.success("اتعملت الشهادة الجمركية");
    });
  }

  function addCost() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addCertificateCostAction({
        certificateId: selected.id,
        costType,
        amount: parseFloat(costAmount) || 0,
        payeeSupplierId: payeeId || null,
        paymentMethod: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) =>
        prev.map((c) => (c.id === selected.id ? result.data : c))
      );
      setCostAmount("");
      toast.success("اتضاف المصروف واتعدّلت تكلفة الوصول");
    });
  }

  function closeCert() {
    if (!selected) return;
    startTransition(async () => {
      const result = await closeCertificateAction(selected.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCertificates((prev) =>
        prev.map((c) => (c.id === selected.id ? result.data : c))
      );
      toast.success("اتقفلت الشهادة");
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الشهادات الجمركية"
        description="رقم الجمارك الرسمي + مصاريف المينا لحد المخزن. شحن المورد على فاتورة الشراء مش هنا."
      />

      <OperationalCard title="شهادة جديدة">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>رقم الشهادة</Label>
            <Input
              className="min-h-11"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="رقم الجمارك"
            />
          </div>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || !newNumber.trim()}
            onClick={createCert}
          >
            إنشاء
          </Button>
        </div>
      </OperationalCard>

      {certificates.length === 0 ? (
        <EmptyStateBlock
          title="مفيش شهادات"
          description="سجّل رقم الشهادة الجمركية لما توصّل الحاويات المينا"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="space-y-2">
            {certificates.map((cert) => (
              <button
                key={cert.id}
                type="button"
                onClick={() => setSelectedId(cert.id)}
                className={`w-full rounded-xl border px-3 py-3 text-start transition ${
                  selectedId === cert.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">{cert.certificate_number}</span>
                  <StatusPill
                    label={CUSTOMS_CERTIFICATE_STATUS_LABELS[cert.status]}
                    variant={cert.status === "open" ? "info" : "success"}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cert.containers.length} حاوية ·{" "}
                  {formatCurrency(cert.costsTotal, currency)}
                </p>
              </button>
            ))}
          </div>

          {selected ? (
            <OperationalCard
              title={selected.certificate_number}
              description={`${selected.containers.length} حاوية مرتبطة`}
              action={
                selected.status === "open" ? (
                  <CompactActions>
                    <CompactAction
                      label="قفل الشهادة"
                      icon={FileBadge}
                      disabled={pending}
                      onClick={closeCert}
                    />
                  </CompactActions>
                ) : null
              }
            >
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">الحاويات</h3>
                  {selected.containers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      اربط الحاوية من قائمة الحاويات أو أمر التوريد
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {selected.containers.map((c) => (
                        <li key={c.id} className="tabular-nums">
                          {c.container_number} · {c.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">المصاريف</h3>
                  <p className="mb-3 text-xs text-muted-foreground">{CERTIFICATE_COST_HINT}</p>
                  {selected.linkedInvoiceExtraCost > 0 ? (
                    <p className="mb-3 rounded-[var(--mds-radius-lg)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                      فواتير الحاويات فيها تكلفة إضافية{" "}
                      {formatCurrency(selected.linkedInvoiceExtraCost, currency)} — ده شحن من
                      المورد على الفاتورة. متسجلش نفس المبلغ تاني هنا.
                    </p>
                  ) : null}
                  {selected.costs.length === 0 ? (
                    <p className="mb-3 text-sm text-muted-foreground">لسه مفيش مصاريف</p>
                  ) : (
                    <ul className="mb-3 space-y-1 text-sm">
                      {selected.costs.map((cost) => (
                        <li key={cost.id} className="flex justify-between gap-2">
                          <span>
                            {CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[cost.cost_type]}
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(cost.amount, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selected.status === "open" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>نوع المصروف</Label>
                        <Select
                          value={costType}
                          onValueChange={(v) => {
                            if (v) setCostType(v as CustomsCertificateCostType);
                          }}
                        >
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue>
                              {() => CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[costType]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMS_CERTIFICATE_COST_TYPES.map((type) => (
                              <SelectItem
                                key={type}
                                value={type}
                                label={CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[type]}
                              >
                                {CUSTOMS_CERTIFICATE_COST_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>المبلغ ({currency})</Label>
                        <Input
                          className="min-h-11"
                          inputMode="decimal"
                          value={costAmount}
                          onChange={(e) => setCostAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>الجهة (مورد/مخلص) — اختياري</Label>
                        <Select
                          value={payeeId || "__none__"}
                          onValueChange={(v) =>
                            setPayeeId(!v || v === "__none__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue>
                              {(value) =>
                                value === "__none__"
                                  ? "بدون"
                                  : suppliers.find((s) => s.id === value)?.name ?? "بدون"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" label="بدون">
                              بدون
                            </SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id} label={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        className="min-h-11 sm:col-span-2"
                        disabled={pending}
                        onClick={addCost}
                      >
                        <Plus className="size-4" />
                        إضافة مصروف وترسملة على التكلفة
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </OperationalCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
