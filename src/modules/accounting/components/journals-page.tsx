"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePenLine, ScrollText, Sparkles, XCircle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Badge } from "@/components/ui/badge";
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
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import type { GlAccount, JournalEntry, JournalEntryStatus, Store } from "@/lib/types";
import {
  createDraftJournalAction,
  getJournalDetailAction,
  postJournalAction,
  voidJournalAction,
} from "@/modules/accounting/actions/journal.actions";
import { AccountingStoreSelect } from "@/modules/accounting/components/accounting-store-select";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";

const STATUS_LABELS: Record<JournalEntryStatus, string> = {
  draft: "مسودة",
  posted: "مرحّل",
  void: "ملغي",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "يدوي",
  sale: "بيع",
  expense: "مصروف",
  purchase: "شراء",
  customer_payment: "تحصيل عميل",
  supplier_payment: "دفعة مورد",
  refund: "مرتجع / إلغاء",
  adjustment: "تسوية",
  waste: "هالك",
};

type DraftLine = {
  account_id: string;
  debit: string;
  credit: string;
  memo: string;
};

interface JournalsPageProps {
  entries: JournalEntry[];
  accounts: GlAccount[];
  stores: Store[];
  storeId: string;
  currency: string;
  canManage: boolean;
}

function emptyLine(): DraftLine {
  return { account_id: "", debit: "", credit: "", memo: "" };
}

export function JournalsPage({
  entries,
  accounts,
  stores,
  storeId,
  currency,
  canManage,
}: JournalsPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | JournalEntryStatus>(
    "all"
  );
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const [storeFilter, setStoreFilter] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [detailLines, setDetailLines] = useState<
    { account_id: string; debit: number; credit: number; memo: string }[]
  >([]);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const [detailTotals, setDetailTotals] = useState({ debit: 0, credit: 0 });
  const [voidEntryId, setVoidEntryId] = useState<string | null>(null);
  const [form, setForm] = useState({
    storeId,
    entryDate: new Date().toISOString().slice(0, 10),
    memo: "",
    lines: [emptyLine(), emptyLine()] as DraftLine[],
  });

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s.name])),
    [stores]
  );

  const counts = useMemo(() => {
    let posted = 0;
    let draft = 0;
    let voided = 0;
    let auto = 0;
    for (const e of entries) {
      if (e.status === "posted") {
        posted += 1;
        if (e.source !== "manual") auto += 1;
      } else if (e.status === "draft") draft += 1;
      else voided += 1;
    }
    return { posted, draft, voided, auto, total: entries.length };
  }, [entries]);

  const sources = useMemo(() => {
    const set = new Set(entries.map((e) => e.source));
    return Array.from(set).sort();
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim();
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (sourceFilter !== "all" && entry.source !== sourceFilter) return false;
      if (storeFilter !== "all") {
        if (storeFilter === "__none__") {
          if (entry.store_id) return false;
        } else if (entry.store_id !== storeFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        entry.entry_number.includes(q) ||
        entry.memo.includes(q) ||
        (SOURCE_LABELS[entry.source] ?? entry.source).includes(q)
      );
    });
  }, [entries, query, sourceFilter, statusFilter, storeFilter]);

  const draftFormTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of form.lines) {
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.0001 };
  }, [form.lines]);

  const resetForm = () =>
    setForm({
      storeId,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: "",
      lines: [emptyLine(), emptyLine()],
    });

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  };

  const onCreate = () => {
    startTransition(async () => {
      const lines = form.lines
        .map((line) => ({
          account_id: line.account_id,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          memo: line.memo,
        }))
        .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0));

      const result = await createDraftJournalAction({
        storeId: form.storeId,
        entryDate: form.entryDate,
        memo: form.memo,
        lines,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم حفظ المسودة");
      setOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const onPost = (id: string) => {
    startTransition(async () => {
      const result = await postJournalAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم ترحيل القيد");
      router.refresh();
    });
  };

  const onVoid = (id: string) => {
    setVoidEntryId(id);
  };

  const confirmVoid = async () => {
    if (!voidEntryId) return;
    const result = await voidJournalAction(voidEntryId);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("تم إلغاء القيد");
    setVoidEntryId(null);
    router.refresh();
  };

  const onOpenDetail = (entry: JournalEntry) => {
    startTransition(async () => {
      const detail = await getJournalDetailAction(entry.id);
      if (!detail) {
        toast.error("القيد غير موجود");
        return;
      }
      setDetailEntry(detail);
      setDetailLines(detail.lines);
      setDetailTotals({
        debit: detail.lines.reduce((sum, line) => sum + line.debit, 0),
        credit: detail.lines.reduce((sum, line) => sum + line.credit, 0),
      });
      setDetailOpen(true);
    });
  };

  return (
    <>
      <PageHeader
        title="القيود اليومية"
        description="إنشاء وترحيل وإلغاء القيود اليدوية — والترحيل الأوتوماتيك من البيع والمشتريات والمصروفات يظهر هنا"
        action={
          canManage ? (
            <Button type="button" onClick={() => setOpen(true)}>
              قيد جديد
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <AccountingSubnav />
      </div>

      <div className="mb-4 grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="كل القيود"
          value={String(counts.total)}
          change="آخر 200 قيد"
          trend="neutral"
          icon={<ScrollText className="size-5" />}
        />
        <KpiCard
          label="مرحلة"
          value={String(counts.posted)}
          change={`${counts.auto} أوتوماتيك`}
          trend="up"
          icon={<Sparkles className="size-5" />}
        />
        <KpiCard
          label="مسودات"
          value={String(counts.draft)}
          change={counts.draft > 0 ? "جاهزة للترحيل" : "مفيش معلّق"}
          trend={counts.draft > 0 ? "down" : "neutral"}
          icon={<FilePenLine className="size-5" />}
        />
        <KpiCard
          label="ملغاة"
          value={String(counts.voided)}
          change="مراجعة عكسية"
          trend="neutral"
          icon={<XCircle className="size-5" />}
        />
      </div>

      <OperationalCard
        title="سجل القيود"
        description={`عرض ${visible.length} من ${entries.length}`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="je-search">بحث</Label>
            <Input
              id="je-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="رقم القيد أو البيان"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>الفرع</Label>
            <Select
              value={storeFilter}
              onValueChange={(v) => {
                if (!v) return;
                setStoreFilter(v);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? "كل الفروع"
                      : value === "__none__"
                        ? "بدون فرع"
                        : selectLabelById(stores, value, (s) => s.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="كل الفروع">
                  كل الفروع
                </SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id} label={store.name}>
                    {store.name}
                  </SelectItem>
                ))}
                <SelectItem value="__none__" label="بدون فرع">
                  بدون فرع
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>الحالة</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                if (!v) return;
                setStatusFilter(v as "all" | JournalEntryStatus);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? "كل الحالات"
                      : STATUS_LABELS[value as JournalEntryStatus] ?? null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="كل الحالات">
                  كل الحالات
                </SelectItem>
                <SelectItem value="posted" label="مرحّل">
                  مرحّل
                </SelectItem>
                <SelectItem value="draft" label="مسودة">
                  مسودة
                </SelectItem>
                <SelectItem value="void" label="ملغي">
                  ملغي
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>المصدر</Label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                if (!v) return;
                setSourceFilter(v);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? "كل المصادر"
                      : value
                        ? (SOURCE_LABELS[String(value)] ?? String(value))
                        : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="كل المصادر">
                  كل المصادر
                </SelectItem>
                {sources.map((source) => (
                  <SelectItem
                    key={source}
                    value={source}
                    label={SOURCE_LABELS[source] ?? source}
                  >
                    {SOURCE_LABELS[source] ?? source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyStateBlock
            title="مفيش قيود"
            description="أنشئ قيدًا يدويًا أو انتظر الترحيل التلقائي من العمليات."
          />
        ) : visible.length === 0 ? (
          <EmptyStateBlock
            title="مفيش نتائج"
            description="غيّر البحث أو الفلاتر."
          />
        ) : (
          <ResponsiveListLayout
            mobile={visible.map((entry) => (
              <MobileEntityCard
                key={entry.id}
                title={entry.entry_number}
                subtitle={entry.memo || "—"}
                badge={
                  <Badge
                    variant={
                      entry.status === "posted"
                        ? "default"
                        : entry.status === "void"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                }
                fields={[
                  { label: "التاريخ", value: entry.entry_date },
                  {
                    label: "الفرع",
                    value: entry.store_id
                      ? (storeMap.get(entry.store_id) ?? "فرع")
                      : "كل الفروع",
                  },
                  {
                    label: "المصدر",
                    value: SOURCE_LABELS[entry.source] ?? entry.source,
                  },
                ]}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => onOpenDetail(entry)}
                    >
                      عرض
                    </Button>
                    {canManage && entry.status === "draft" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => onPost(entry.id)}
                      >
                        ترحيل
                      </Button>
                    ) : null}
                    {canManage && entry.status === "posted" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => onVoid(entry.id)}
                      >
                        إلغاء
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الرقم</th>
                      <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                      <th className="px-3 py-2 text-start font-medium">الفرع</th>
                      <th className="px-3 py-2 text-start font-medium">البيان</th>
                      <th className="px-3 py-2 text-start font-medium">المصدر</th>
                      <th className="px-3 py-2 text-start font-medium">الحالة</th>
                      <th className="px-3 py-2 text-start font-medium">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">
                          {entry.entry_number}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{entry.entry_date}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {entry.store_id
                            ? (storeMap.get(entry.store_id) ?? "فرع")
                            : "كل الفروع"}
                        </td>
                        <td className="px-3 py-2">{entry.memo || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {SOURCE_LABELS[entry.source] ?? entry.source}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              entry.status === "posted"
                                ? "default"
                                : entry.status === "void"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {STATUS_LABELS[entry.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => onOpenDetail(entry)}
                            >
                              عرض
                            </Button>
                            {canManage && entry.status === "draft" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => onPost(entry.id)}
                              >
                                ترحيل
                              </Button>
                            ) : null}
                            {canManage && entry.status === "posted" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => onVoid(entry.id)}
                              >
                                إلغاء
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setOpen(v);
        }}
      >
        <StandardModalContent
          size="lg"
          title="قيد يومية جديد"
          description="أدخل تاريخ القيد والبيان والأسطر — المدين لازم يساوي الدائن."
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl font-semibold"
                disabled={pending}
                onClick={onCreate}
              >
                حفظ مسودة
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <AccountingStoreSelect
                id="je-store"
                stores={stores}
                value={form.storeId}
                onValueChange={(storeId) =>
                  setForm((f) => ({ ...f, storeId }))
                }
              />
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="je-date">التاريخ</Label>
                <Input
                  id="je-date"
                  type="date"
                  value={form.entryDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entryDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="je-memo">البيان</Label>
              <Input
                id="je-memo"
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>الأسطر</Label>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span>
                    مدين {formatCurrency(draftFormTotals.debit, currency)}
                  </span>
                  <span>
                    دائن {formatCurrency(draftFormTotals.credit, currency)}
                  </span>
                  <span
                    className={
                      draftFormTotals.balanced
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-destructive"
                    }
                  >
                    {draftFormTotals.balanced ? "متوازن" : "مش متوازن"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
                  }
                >
                  سطر إضافي
                </Button>
              </div>
              {form.lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                >
                  <Select
                    value={line.account_id || undefined}
                    onValueChange={(v) => {
                      if (!v) return;
                      updateLine(index, { account_id: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} — {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    placeholder="مدين"
                    value={line.debit}
                    onChange={(e) =>
                      updateLine(index, {
                        debit: e.target.value,
                        credit: e.target.value ? "" : line.credit,
                      })
                    }
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="دائن"
                    value={line.credit}
                    onChange={(e) =>
                      updateLine(index, {
                        credit: e.target.value,
                        debit: e.target.value ? "" : line.debit,
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={form.lines.length <= 2}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        lines: f.lines.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    حذف
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </StandardModalContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <StandardModalContent
          size="md"
          title={detailEntry?.entry_number ?? "تفاصيل القيد"}
          description={detailEntry?.memo || "بدون بيان"}
          footer={
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setDetailOpen(false)}
            >
              إغلاق
            </Button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">التاريخ</div>
              <div className="tabular-nums">{detailEntry?.entry_date ?? "—"}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">المصدر</div>
              <div>
                {detailEntry
                  ? (SOURCE_LABELS[detailEntry.source] ?? detailEntry.source)
                  : "—"}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">الحالة</div>
              <div>
                {detailEntry ? STATUS_LABELS[detailEntry.status] : "—"}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">الحساب</th>
                  <th className="px-3 py-2 text-start">مدين</th>
                  <th className="px-3 py-2 text-start">دائن</th>
                </tr>
              </thead>
              <tbody>
                {detailLines.map((line, i) => {
                  const account = accountMap.get(line.account_id);
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">
                        {account
                          ? `${account.code} — ${account.name}`
                          : line.account_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.debit > 0 ? formatCurrency(line.debit, currency) : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.credit > 0 ? formatCurrency(line.credit, currency) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-3 py-2">الإجمالي</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatCurrency(detailTotals.debit, currency)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatCurrency(detailTotals.credit, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </StandardModalContent>
      </Dialog>

      <ConfirmActionDialog
        open={voidEntryId != null}
        onOpenChange={(open) => {
          if (!open) setVoidEntryId(null);
        }}
        title="إلغاء ترحيل القيد"
        description="تأكيد إلغاء ترحيل القيد؟ لا يمكن التراجع عن هذا الإجراء بسهولة."
        confirmLabel="إلغاء الترحيل"
        destructive
        onConfirm={confirmVoid}
      />
    </>
  );
}
