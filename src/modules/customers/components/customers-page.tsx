"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Heart,
  Landmark,
  Plus,
  Search,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
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
import { PageHeader } from "@/components/Velora/page-header";
import { CompactAction } from "@/components/Velora/compact-actions";
import { KpiCard } from "@/components/Velora/kpi-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { formatCurrency } from "@/lib/format";
import { firstGrapheme } from "@/lib/first-grapheme";
import type { Customer } from "@/lib/types";
import type { AgingBuckets } from "@/modules/reports/lib/aging-buckets";
import { AgingBucketsChart } from "@/modules/reports/components/aging-buckets-chart";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { createCustomerAction } from "@/modules/customers/actions/customer.actions";

interface CustomersPageProps {
  customers: Customer[];
  currency?: string;
  glance?: {
    collected30d: number;
    agingBuckets: AgingBuckets;
    partiesWithBalance: number;
  } | null;
  /** Soft-hide AR credit KPI when org credit_sales is off. */
  creditSalesEnabled?: boolean;
}

export function CustomersPage({
  customers: initial,
  currency = "EGP",
  glance = null,
  creditSalesEnabled = false,
}: CustomersPageProps) {
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", tax_id: "" });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const creditBalance = customers.reduce(
    (sum, c) => sum + (c.account_balance ?? 0),
    0
  );

  const create = () => {
    startTransition(async () => {
      try {
        const customer = await createCustomerAction(form);
        setCustomers([customer, ...customers]);
        setShowCreate(false);
        setForm({ name: "", phone: "", email: "", address: "", tax_id: "" });
        toast.success("تم إنشاء العميل");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <PageHeader
        breadcrumb={
          <span>
            <Link href="/customers" className="text-primary hover:underline">
              العملاء
            </Link>
            <span className="mx-1 text-muted-foreground">/</span>
            دليل العملاء
          </span>
        }
        title="دليل العملاء"
        description="العلاقات والسجل والولاء"
        action={
          <CompactAction
            label="إضافة عميل"
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setShowCreate(true)}
          />
        }
      />

      <div
        className={
          creditSalesEnabled
            ? "grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-[var(--mds-space-4)] sm:grid-cols-2"
        }
      >
        <KpiCard
          label="إجمالي العملاء"
          value={String(customers.length)}
          icon={<Users className="size-5" />}
        />
        <KpiCard
          label="نتائج البحث"
          value={String(filtered.length)}
          change={search.trim() ? "مطابقة للفلتر الحالي" : "كل العملاء"}
          trend="neutral"
        />
        {creditSalesEnabled ? (
          <>
            <KpiCard
              label="رصيد آجل"
              value={formatCurrency(creditBalance, currency)}
              change={
                glance
                  ? `${glance.partiesWithBalance} عميل عليهم رصيد`
                  : "مجموع أرصدة العملاء"
              }
              trend="neutral"
              icon={<Landmark className="size-5" />}
            />
            <KpiCard
              label="تحصيل (30 يوم)"
              value={formatCurrency(glance?.collected30d ?? 0, currency)}
              icon={<Wallet className="size-5" />}
            />
          </>
        ) : null}
      </div>

      {creditSalesEnabled && glance ? (
        <AgingBucketsChart
          title="أعمار ذمم العملاء"
          buckets={glance.agingBuckets}
          currency={currency}
          barColor="#D97706"
        />
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="تحليل العملاء"
        description="مديونية وكشف حساب وولاء"
        links={[
          ...(creditSalesEnabled
            ? [
                {
                  href: "/reports/aging?side=customers",
                  label: "مديونية العملاء",
                  description: "أعمار الذمم والتحصيل",
                  icon: Landmark,
                },
              ]
            : []),
          {
            href: "/reports/statement?party=customer",
            label: "كشف حساب عميل",
            description: "حركات مفصّلة على فترة",
            icon: BookOpen,
          },
          {
            href: "/customers/loyalty",
            label: "الولاء",
            description: "نقاط صادرة ومستخدمة",
            icon: Heart,
          },
        ]}
      />

      <div className="relative w-full max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف..."
          className="h-11 rounded-[var(--mds-radius-md)] ps-10 md:h-10"
          aria-label="بحث العملاء"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col gap-[var(--mds-space-4)]">
          <EmptyStateBlock
            title={search.trim() ? "لا نتائج" : "لا يوجد عملاء"}
            description={
              search.trim()
                ? "جرّب اسمًا أو رقم هاتف مختلف."
                : creditSalesEnabled
                  ? "أضف عميلًا للبدء في الولاء والبيع الآجل."
                  : "أضف عميلًا للبدء في الولاء وسجل المبيعات."
            }
          />
          {!search.trim() ? (
            <div className="flex justify-center">
              <Button
                className="shadow-[var(--mds-elevation-1)]"
                onClick={() => setShowCreate(true)}
              >
                إضافة عميل
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="min-w-0">
              <OperationalCard className="h-full transition-shadow hover:shadow-[var(--mds-elevation-2)]">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {c.name.trim() ? firstGrapheme(c.name) : <UserRound className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(c.total_spent, currency)}
                      </p>
                    </div>
                    <p className="truncate text-sm text-muted-foreground" dir="ltr">
                      {c.phone}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {c.visit_count} زيارة
                      </span>
                      {c.account_balance > 0 ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                          مستحق {formatCurrency(c.account_balance, currency)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </OperationalCard>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-[var(--mds-radius-lg)]">
          <DialogHeader>
            <DialogTitle>عميل جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-name">الاسم</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-phone">الهاتف</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-email">البريد الإلكتروني</Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-address">العنوان</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-tax">الرقم الضريبي</Label>
              <Input
                id="customer-tax"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <Button
              className="shadow-[var(--mds-elevation-1)]"
              onClick={create}
              disabled={pending || form.name.trim().length < 2 || form.phone.trim().length < 8}
            >
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
