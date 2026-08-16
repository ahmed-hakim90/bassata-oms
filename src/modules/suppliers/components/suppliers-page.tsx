"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Banknote, BookOpen, Landmark, Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { SupplierListSummary } from "@/lib/types";
import type { AgingBuckets } from "@/modules/reports/lib/aging-buckets";
import { AgingBucketsChart } from "@/modules/reports/components/aging-buckets-chart";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import {
  createSupplierFromSuppliersAction,
  getSuppliersPageDataAction,
} from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "@/modules/suppliers/components/record-payment-dialog";

interface SuppliersPageProps {
  summaries: SupplierListSummary[];
  currency: string;
  canManagePayments?: boolean;
  glance?: {
    paid30d: number;
    agingBuckets: AgingBuckets;
    partiesWithBalance: number;
  } | null;
}

export function SuppliersPage({
  summaries: initial,
  currency,
  canManagePayments = false,
  glance = null,
}: SuppliersPageProps) {
  const router = useRouter();
  const [summaries, setSummaries] = useState(initial);
  const [paid30d, setPaid30d] = useState(glance?.paid30d ?? 0);
  const [agingBuckets, setAgingBuckets] = useState(glance?.agingBuckets ?? null);
  const [partiesWithBalance, setPartiesWithBalance] = useState(
    glance?.partiesWithBalance ?? 0
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    contact_info: "",
    opening_balance: "0",
    address: "",
    tax_id: "",
  });

  const filtered = summaries.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_info.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayables = useMemo(
    () => summaries.reduce((sum, s) => sum + Math.max(0, s.balanceDue), 0),
    [summaries]
  );

  const openPayment = (supplierId?: string) => {
    setPaymentSupplierId(supplierId);
    setShowPayment(true);
  };

  const create = () => {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const opening = parseFloat(form.opening_balance) || 0;
    if (opening < 0) {
      toast.error("رصيد مستحق سابق لازم يكون صفر أو أكبر");
      return;
    }
    startTransition(async () => {
      const result = await createSupplierFromSuppliersAction({
        name: form.name.trim(),
        contact_info: form.contact_info.trim(),
        opening_balance: opening,
        address: form.address.trim(),
        tax_id: form.tax_id.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = result.data;
      setSummaries([
        {
          ...created,
          totalPurchased: 0,
          totalPaid: 0,
          balanceDue: created.opening_balance,
          invoiceCount: 0,
          lastActivityAt: null,
        },
        ...summaries,
      ]);
      setShowCreate(false);
      setForm({ name: "", contact_info: "", opening_balance: "0", address: "", tax_id: "" });
      toast.success("تم إنشاء المورد");
    });
  };

  return (
    <>
      <PageHeader
        title="الموردون"
        description="أرصدة الموردين وكشوف الحساب"
        action={
          <CompactActions>
            {canManagePayments && summaries.length > 0 ? (
              <CompactAction
                label="تسجيل دفعة"
                icon={Banknote}
                onClick={() => openPayment()}
              />
            ) : null}
            <CompactAction
              label="إضافة مورد"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setShowCreate(true)}
            />
          </CompactActions>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="إجمالي المستحقات"
          value={formatCurrency(totalPayables, currency)}
          change={
            agingBuckets
              ? `${partiesWithBalance} مورد عليهم رصيد`
              : undefined
          }
          trend="neutral"
          icon={<Landmark className="size-5" />}
        />
        <KpiCard label="الموردون" value={String(summaries.length)} />
        <KpiCard
          label="سداد (30 يوم)"
          value={formatCurrency(paid30d, currency)}
          icon={<Banknote className="size-5" />}
        />
        <KpiCard
          label="نتائج البحث"
          value={String(filtered.length)}
          change={search.trim() ? "مطابقة للفلتر" : "كل الموردين"}
          trend="neutral"
        />
      </div>

      {agingBuckets ? (
        <div className="mb-3">
          <AgingBucketsChart
            title="أعمار ذمم الموردين"
            buckets={agingBuckets}
            currency={currency}
            barColor="#2563EB"
          />
        </div>
      ) : null}

      <div className="mb-3">
        <ModuleAnalyticsQuickLinks
          title="تحليل الموردين"
          description="مديونية وكشف حساب ومشتريات"
          links={[
            {
              href: "/reports/aging?side=suppliers",
              label: "مديونية الموردين",
              description: "أعمار الذمم والمستحقات",
              icon: Landmark,
            },
            {
              href: "/reports/statement?party=supplier",
              label: "كشف حساب مورد",
              description: "حركات مفصّلة على فترة",
              icon: BookOpen,
            },
            {
              href: "/inventory/purchases",
              label: "المشتريات",
              description: "فواتير الاستلام",
              icon: Truck,
            },
          ]}
        />
      </div>

      <div className="relative mb-3 max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن موردين..."
          className="ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="space-y-4">
          <EmptyStateBlock
            title={search.trim() ? "لا نتائج" : "لا يوجد موردون"}
            description={
              search.trim()
                ? "جرّب اسم مورد مختلف."
                : "أضف موردًا لتتبع المشتريات والمستحقات."
            }
          />
          {!search.trim() ? (
            <div className="flex justify-center">
              <Button onClick={() => setShowCreate(true)}>إضافة مورد</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <OperationalCard key={s.id} className="transition-all hover:shadow-lg">
              <Link href={`/inventory/suppliers/${s.id}`} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.contact_info ? (
                      <p className="truncate text-sm text-muted-foreground">{s.contact_info}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.invoiceCount} فاتورة مستلمة
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatCurrency(s.balanceDue, currency)}</p>
                    <p className="text-xs text-muted-foreground">رصيد مستحق</p>
                  </div>
                </div>
                {s.lastActivityAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    آخر نشاط {formatDateTime(s.lastActivityAt)}
                  </p>
                ) : null}
              </Link>
              {canManagePayments ? (
                <div className="mt-3 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openPayment(s.id)}
                  >
                    <Banknote className="size-4" /> تسجيل دفعة
                  </Button>
                </div>
              ) : null}
            </OperationalCard>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>مورد جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>بيانات التواصل</Label>
              <Input
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="البريد أو الهاتف"
              />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الرقم الضريبي</Label>
              <Input
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>رصيد مستحق سابق</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                لو فيه مستحقات قديمة قبل النظام — اكتبها هنا.
              </p>
            </div>
            <Button onClick={create} disabled={pending}>
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {canManagePayments ? (
        <RecordPaymentDialog
          open={showPayment}
          onOpenChange={(open) => {
            setShowPayment(open);
            if (!open) setPaymentSupplierId(undefined);
          }}
          suppliers={paymentSupplierId ? undefined : summaries}
          currency={currency}
          initialSupplierId={paymentSupplierId}
          supplierId={paymentSupplierId}
          onSuccess={() => {
            startTransition(async () => {
              try {
                const data = await getSuppliersPageDataAction();
                setSummaries(data.summaries);
                setPaid30d(data.glance.paid30d);
                setAgingBuckets(data.glance.agingBuckets);
                setPartiesWithBalance(data.glance.partiesWithBalance);
              } catch {
                router.refresh();
              }
            });
          }}
        />
      ) : null}
    </>
  );
}
