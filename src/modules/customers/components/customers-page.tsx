"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, UserRound } from "lucide-react";
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
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { formatCurrency } from "@/lib/format";
import { firstGrapheme } from "@/lib/first-grapheme";
import type { Customer } from "@/lib/types";
import { createCustomerAction } from "@/modules/customers/actions/customer.actions";

interface CustomersPageProps {
  customers: Customer[];
  /** Soft-hide AR credit KPI when org credit_sales is off. */
  creditSalesEnabled?: boolean;
}

export function CustomersPage({
  customers: initial,
  creditSalesEnabled = false,
}: CustomersPageProps) {
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const create = () => {
    startTransition(async () => {
      try {
        const customer = await createCustomerAction(form);
        setCustomers([customer, ...customers]);
        setShowCreate(false);
        setForm({ name: "", phone: "", email: "" });
        toast.success("تم إنشاء العميل");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
      }
    });
  };

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        breadcrumb={<span>العملاء</span>}
        title="العملاء"
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
            ? "grid gap-[var(--mds-space-4)] sm:grid-cols-3"
            : "grid gap-[var(--mds-space-4)] sm:grid-cols-2"
        }
      >
        <OperationalCard title="إجمالي العملاء" value={String(customers.length)} />
        <OperationalCard
          title="نتائج البحث"
          value={String(filtered.length)}
          subtitle={search.trim() ? "مطابقة للفلتر الحالي" : "كل العملاء"}
          accent="var(--mds-color-feedback-info)"
        />
        {creditSalesEnabled ? (
          <OperationalCard
            title="رصيد آجل"
            value={formatCurrency(
              customers.reduce((sum, c) => sum + (c.account_balance ?? 0), 0)
            )}
            subtitle="مجموع أرصدة العملاء"
            accent="var(--mds-color-feedback-warning)"
          />
        ) : null}
      </div>

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
                        {formatCurrency(c.total_spent)}
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
                          مستحق {formatCurrency(c.account_balance)}
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
