"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Landmark, Plus, Power, ScrollText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
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
import type { GlAccountType } from "@/lib/types";
import {
  createGlAccountAction,
  deactivateGlAccountAction,
  updateGlAccountAction,
} from "@/modules/accounting/actions/gl-account.actions";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import type { AccountingOverview } from "@/modules/accounting/services/accounting-overview.service";
import type { GlAccountTreeNode } from "@/modules/accounting/services/gl-account.service";

const TYPE_LABELS: Record<GlAccountType, string> = {
  asset: "أصل",
  liability: "خصم",
  equity: "ملكية",
  revenue: "إيراد",
  expense: "مصروف",
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

interface ChartOfAccountsPageProps {
  accounts: GlAccountTreeNode[];
  flat: GlAccountTreeNode[];
  overview: AccountingOverview;
  canManage: boolean;
}

export function ChartOfAccountsPage({
  accounts,
  flat,
  overview,
  canManage,
}: ChartOfAccountsPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | GlAccountType>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    account_type: "expense" as GlAccountType,
    parent_id: "",
    is_postable: true,
  });

  const typeCounts = useMemo(() => {
    const counts: Record<GlAccountType, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    };
    for (const a of flat) {
      if (a.is_active) counts[a.account_type] += 1;
    }
    return counts;
  }, [flat]);

  const visible = useMemo(() => {
    const q = query.trim();
    return flat.filter((a) => {
      if (typeFilter !== "all" && a.account_type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.code.includes(q) ||
        a.name.includes(q) ||
        (a.system_key ?? "").includes(q)
      );
    });
  }, [flat, query, typeFilter]);

  const resetForm = () =>
    setForm({
      code: "",
      name: "",
      account_type: "expense",
      parent_id: "",
      is_postable: true,
    });

  const onCreate = () => {
    startTransition(async () => {
      const result = await createGlAccountAction({
        code: form.code,
        name: form.name,
        account_type: form.account_type,
        parent_id: form.parent_id || null,
        is_postable: form.is_postable,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم إضافة الحساب");
      setOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const onToggleActive = (account: GlAccountTreeNode) => {
    startTransition(async () => {
      const result = account.is_active
        ? await deactivateGlAccountAction(account.id)
        : await updateGlAccountAction(account.id, { is_active: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(account.is_active ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        title="دليل الحسابات"
        description="شجرة الحسابات المستخدمة في القيود والترحيل التلقائي من البيع والمشتريات والمصروفات"
        action={
          canManage ? (
            <CompactAction
              label="حساب جديد"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setOpen(true)}
            />
          ) : undefined
        }
      />

      <div className="mb-4">
        <AccountingSubnav />
      </div>

      <div className="mb-4 grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="حسابات نشطة"
          value={String(overview.accountCount)}
          change={`${overview.postableCount} قابل للترحيل`}
          trend="neutral"
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label="قيود مرحلة"
          value={String(overview.postedCount)}
          change={`${overview.autoPostedCount} أوتوماتيك`}
          trend="up"
          icon={<ScrollText className="size-5" />}
        />
        <KpiCard
          label="مسودات"
          value={String(overview.draftCount)}
          change={overview.draftCount > 0 ? "محتاجة ترحيل" : "مفيش معلّق"}
          trend={overview.draftCount > 0 ? "down" : "neutral"}
          icon={<BookOpen className="size-5" />}
        />
        <KpiCard
          label="ملغاة"
          value={String(overview.voidCount)}
          change="من آخر 200 قيد"
          trend="neutral"
          icon={<Sparkles className="size-5" />}
        />
      </div>

      <OperationalCard
        title="الحسابات"
        description={`${visible.length} من ${flat.length} · أصول ${typeCounts.asset} · خصوم ${typeCounts.liability} · ملكية ${typeCounts.equity} · إيراد ${typeCounts.revenue} · مصروف ${typeCounts.expense}`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="coa-search">بحث</Label>
            <Input
              id="coa-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="كود أو اسم الحساب"
              className="mt-1"
            />
          </div>
          <div>
            <Label>النوع</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                if (!v) return;
                setTypeFilter(v as "all" | GlAccountType);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {(Object.keys(TYPE_LABELS) as GlAccountType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]} ({typeCounts[type]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {accounts.length === 0 ? (
          <EmptyStateBlock
            title="مفيش حسابات"
            description="هيتزرع دليل الحسابات الافتراضي تلقائيًا عند أول فتح."
          />
        ) : visible.length === 0 ? (
          <EmptyStateBlock
            title="مفيش نتائج"
            description="غيّر البحث أو فلتر النوع."
          />
        ) : (
          <ResponsiveListLayout
            mobile={visible.map((account) => (
              <MobileEntityCard
                key={account.id}
                title={account.code}
                subtitle={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span>{account.name}</span>
                    {account.is_system ? (
                      <Badge variant="secondary">نظام</Badge>
                    ) : null}
                    {!account.is_postable ? (
                      <Badge variant="outline">تجميعي</Badge>
                    ) : null}
                  </span>
                }
                badge={
                  <Badge variant="outline">
                    {TYPE_LABELS[account.account_type]}
                  </Badge>
                }
                fields={[
                  {
                    label: "الحالة",
                    value: account.is_active ? (
                      <span className="text-emerald-700 dark:text-emerald-400">نشط</span>
                    ) : (
                      <span className="text-muted-foreground">معطّل</span>
                    ),
                  },
                ]}
                footer={
                  <CompactActions className="w-full justify-end">
                    {account.is_postable ? (
                      <CompactAction
                        label="دفتر"
                        icon={BookOpen}
                        href={`/accounting/ledger?accountId=${account.id}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">مفيش دفتر</span>
                    )}
                    {canManage && !account.is_system ? (
                      <CompactAction
                        label={account.is_active ? "تعطيل" : "تفعيل"}
                        icon={Power}
                        variant="ghost"
                        disabled={pending}
                        onClick={() => onToggleActive(account)}
                      />
                    ) : null}
                  </CompactActions>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الكود</th>
                      <th className="px-3 py-2 text-start font-medium">الاسم</th>
                      <th className="px-3 py-2 text-start font-medium">النوع</th>
                      <th className="px-3 py-2 text-start font-medium">الحالة</th>
                      <th className="px-3 py-2 text-start font-medium">دفتر</th>
                      {canManage ? (
                        <th className="px-3 py-2 text-start font-medium">إجراء</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((account) => (
                      <tr key={account.id} className="border-t">
                        <td
                          className="px-3 py-2 font-mono tabular-nums"
                          style={{ paddingInlineStart: `${12 + account.depth * 16}px` }}
                        >
                          {account.code}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{account.name}</span>
                            {account.is_system ? (
                              <Badge variant="secondary">نظام</Badge>
                            ) : null}
                            {!account.is_postable ? (
                              <Badge variant="outline">تجميعي</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            {TYPE_LABELS[account.account_type]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {account.is_active ? (
                            <span className="text-emerald-700 dark:text-emerald-400">نشط</span>
                          ) : (
                            <span className="text-muted-foreground">معطّل</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {account.is_postable ? (
                            <Link
                              href={`/accounting/ledger?accountId=${account.id}`}
                              className="text-sm text-primary underline-offset-2 hover:underline"
                            >
                              دفتر
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        {canManage ? (
                          <td className="px-3 py-2">
                            {!account.is_system ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => onToggleActive(account)}
                              >
                                {account.is_active ? "تعطيل" : "تفعيل"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>

      {overview.recentPosted.length > 0 ? (
        <OperationalCard
          title="آخر قيود مرحلة"
          description="من البيع والمصروفات والقيود اليدوية"
          className="mt-4"
        >
          <ResponsiveListLayout
            mobile={overview.recentPosted.map((entry) => (
              <MobileEntityCard
                key={entry.id}
                href="/accounting/journals"
                title={entry.entry_number}
                subtitle={entry.memo || "—"}
                fields={[
                  { label: "التاريخ", value: entry.entry_date },
                  {
                    label: "المصدر",
                    value: SOURCE_LABELS[entry.source] ?? entry.source,
                  },
                ]}
                trailingHint="فتح القيود ←"
              />
            ))}
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الرقم</th>
                      <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                      <th className="px-3 py-2 text-start font-medium">البيان</th>
                      <th className="px-3 py-2 text-start font-medium">المصدر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentPosted.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href="/accounting/journals"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {entry.entry_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{entry.entry_date}</td>
                        <td className="px-3 py-2">{entry.memo || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {SOURCE_LABELS[entry.source] ?? entry.source}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        </OperationalCard>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setOpen(v);
        }}
      >
        <StandardModalContent
          size="sm"
          title="حساب جديد"
          description="أضف حسابًا يدويًا تحت الدليل الحالي. حسابات النظام محمية من الحذف."
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
                حفظ
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coa-code">الكود</Label>
              <Input
                id="coa-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coa-name">الاسم</Label>
              <Input
                id="coa-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={form.account_type}
                onValueChange={(v) => {
                  if (!v) return;
                  setForm((f) => ({ ...f, account_type: v as GlAccountType }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as GlAccountType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحساب الأب (اختياري)</Label>
              <Select
                value={form.parent_id || "__none__"}
                onValueChange={(v) => {
                  if (v == null) return;
                  setForm((f) => ({
                    ...f,
                    parent_id: v === "__none__" ? "" : v,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بدون أب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون أب</SelectItem>
                  {flat
                    .filter((a) => a.account_type === form.account_type)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
