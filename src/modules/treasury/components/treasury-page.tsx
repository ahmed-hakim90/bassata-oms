"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  sweepPeriodToHqAction,
  transferTreasuryAction,
} from "@/modules/treasury/actions/treasury.actions";
import {
  treasuryEntryLabel,
  type TreasuryPageData,
} from "@/modules/treasury/lib/treasury-view";
import type { CashTreasuryEntryType } from "@/lib/types";

const ENTRY_TYPES: CashTreasuryEntryType[] = [
  "transfer_out",
  "transfer_in",
  "cashier_collect",
  "expense_payout",
  "collection_deposit",
  "supplier_payout",
  "period_sweep",
];

type Filters = {
  treasuryId: string;
  entryType: string;
  from: string;
  to: string;
};

export function TreasuryPage({
  data,
  filters,
}: {
  data: TreasuryPageData;
  filters: Filters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [fromId, setFromId] = useState(data.treasuries.find((t) => t.kind === "store")?.id ?? "");
  const [toId, setToId] = useState(data.treasuries.find((t) => t.kind === "hq")?.id ?? "");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [sweepPeriodId, setSweepPeriodId] = useState(data.closedPeriods[0]?.id ?? "");

  const hq = data.treasuries.find((t) => t.kind === "hq");
  const stores = data.treasuries.filter((t) => t.kind === "store");
  const selectedPeriod = useMemo(
    () => data.closedPeriods.find((p) => p.id === sweepPeriodId) ?? null,
    [data.closedPeriods, sweepPeriodId]
  );

  function applyFilters(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.treasuryId) params.set("treasuryId", merged.treasuryId);
    if (merged.entryType) params.set("entryType", merged.entryType);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    const qs = params.toString();
    router.push(qs ? `/treasury?${qs}` : "/treasury");
  }

  function submitTransfer(withdrawAll: boolean) {
    const from = data.treasuries.find((t) => t.id === fromId);
    const parsed = withdrawAll ? from?.balance ?? 0 : parseFloat(amount);
    if (!fromId || !toId) {
      toast.error("اختار الخزينة المصدر والوجهة");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("أدخل مبلغ صحيح");
      return;
    }
    startTransition(async () => {
      const result = await transferTreasuryAction({
        fromTreasuryId: fromId,
        toTreasuryId: toId,
        amount: parsed,
        notes: notes.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("تم التحويل بين الخزائن");
      setTransferOpen(false);
      setAmount("");
      setNotes("");
      router.refresh();
    });
  }

  function submitSweep() {
    if (!selectedPeriod?.store_id) {
      toast.error("اختار فترة مقفولة لفرع");
      return;
    }
    startTransition(async () => {
      const result = await sweepPeriodToHqAction({
        storeId: selectedPeriod.store_id!,
        periodId: selectedPeriod.id,
        notes: notes.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`اتسحب ${formatCurrency(result.amount)} للخزينة الرئيسية`);
      setSweepOpen(false);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الخزائن"
        description="خزينة رئيسية للمنشأة وخزينة لكل فرع — توريد من أمانة الكاشير، تحويل، سحب فترة، وسجل حركات."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                setFromId(stores[0]?.id ?? "");
                setToId(hq?.id ?? "");
                setAmount("");
                setNotes("");
                setTransferOpen(true);
              }}
            >
              <ArrowLeftRight className="size-4" />
              تحويل
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setSweepPeriodId(data.closedPeriods[0]?.id ?? "");
                setNotes("");
                setSweepOpen(true);
              }}
              disabled={data.closedPeriods.length === 0}
            >
              سحب فترة كاملة
            </Button>
            <Link
              href="/sessions"
              className="inline-flex h-9 items-center rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              ورديات الكاشير
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hq ? (
          <OperationalCard className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Landmark className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">الخزينة الرئيسية</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(hq.balance)}</p>
              </div>
            </div>
          </OperationalCard>
        ) : null}
        {stores.map((store) => (
          <OperationalCard key={store.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                <Wallet className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{store.label}</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(store.balance)}</p>
              </div>
            </div>
          </OperationalCard>
        ))}
      </div>

      <OperationalCard className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>الخزينة</Label>
            <Select
              value={filters.treasuryId || "all"}
              onValueChange={(v) => applyFilters({ treasuryId: v === "all" ? "" : (v ?? "") })}
            >
              <SelectTrigger className="w-[220px] rounded-xl">
                <SelectValue placeholder="كل الخزائن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخزائن</SelectItem>
                {data.treasuries.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع الحركة</Label>
            <Select
              value={filters.entryType || "all"}
              onValueChange={(v) => applyFilters({ entryType: v === "all" ? "" : (v ?? "") })}
            >
              <SelectTrigger className="w-[200px] rounded-xl">
                <SelectValue placeholder="كل الأنواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {ENTRY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {treasuryEntryLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treasury-from">من</Label>
            <Input
              id="treasury-from"
              type="date"
              className="rounded-xl"
              value={filters.from}
              onChange={(e) => applyFilters({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="treasury-to">إلى</Label>
            <Input
              id="treasury-to"
              type="date"
              className="rounded-xl"
              value={filters.to}
              onChange={(e) => applyFilters({ to: e.target.value })}
            />
          </div>
        </div>

        {data.ledger.length === 0 ? (
          <EmptyStateBlock
            title="مفيش حركات"
            description="لما تورّد من أمانة الكاشير أو تحوّل أو تصرف/تحصّل على خزينة، الحركات هتظهر هنا."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">التاريخ</TableHead>
                  <TableHead className="text-start">النوع</TableHead>
                  <TableHead className="text-start">المبلغ</TableHead>
                  <TableHead className="text-start">الرصيد بعد</TableHead>
                  <TableHead className="text-start">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{treasuryEntryLabel(entry.entry_type)}</TableCell>
                    <TableCell
                      className={`tabular-nums font-semibold ${
                        entry.amount < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(entry.balance_after)}</TableCell>
                    <TableCell className="max-w-[18rem] truncate text-sm text-muted-foreground">
                      {entry.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </OperationalCard>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <StandardModalContent
          title="تحويل بين الخزائن"
          description="التحويل متاح بين الخزينة الرئيسية وخزينة أي فرع."
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setTransferOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                disabled={pending}
                onClick={() => submitTransfer(true)}
              >
                سحب الكل
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={pending}
                onClick={() => submitTransfer(false)}
              >
                تحويل
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>من</Label>
              <Select value={fromId} onValueChange={(v) => setFromId(v ?? "")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {data.treasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} · {formatCurrency(t.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>إلى</Label>
              <Select value={toId} onValueChange={(v) => setToId(v ?? "")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {data.treasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} · {formatCurrency(t.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount">المبلغ</Label>
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="0.01"
                className="rounded-xl"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-notes">ملاحظات</Label>
              <Textarea
                id="transfer-notes"
                className="rounded-xl"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </StandardModalContent>
      </Dialog>

      <Dialog open={sweepOpen} onOpenChange={setSweepOpen}>
        <StandardModalContent
          title="سحب فترة كاملة"
          description="تورّد فائض أمانات الكاشير لخزينة الفرع، وبعدين تحوّل رصيد خزينة الفرع كله للرئيسية. مرة واحدة لكل فترة مقفولة."
          footer={
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setSweepOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={pending || !selectedPeriod}
                onClick={submitSweep}
              >
                سحب الفترة
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>الفترة المقفولة</Label>
              <Select value={sweepPeriodId} onValueChange={(v) => setSweepPeriodId(v ?? "")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="اختار فترة" />
                </SelectTrigger>
                <SelectContent>
                  {data.closedPeriods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {(period.storeName ?? "فرع")} · {period.period_start} → {period.period_end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sweep-notes">ملاحظات</Label>
              <Textarea
                id="sweep-notes"
                className="rounded-xl"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </StandardModalContent>
      </Dialog>
    </div>
  );
}
