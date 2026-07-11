"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
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
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { createCustomerAction } from "@/modules/customers/actions/customer.actions";

interface CustomersPageProps {
  customers: Customer[];
}

export function CustomersPage({ customers: initial }: CustomersPageProps) {
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
    <>
      <PageHeader
        title="العملاء"
        description="العلاقات والسجل والولاء"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> إضافة عميل
          </Button>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف..."
          className="ps-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="space-y-4">
          <EmptyStateBlock
            title={search.trim() ? "لا نتائج" : "لا يوجد عملاء"}
            description={
              search.trim()
                ? "جرّب اسمًا أو رقم هاتف مختلف."
                : "أضف عميلًا للبدء في الولاء والبيع الآجل."
            }
          />
          {!search.trim() ? (
            <div className="flex justify-center">
              <Button onClick={() => setShowCreate(true)}>إضافة عميل</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <OperationalCard className="transition-all hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">{c.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(c.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.visit_count} زيارة
                      {c.account_balance > 0
                        ? ` · ${formatCurrency(c.account_balance)} مستحق`
                        : ""}
                    </p>
                  </div>
                </div>
              </OperationalCard>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>عميل جديد</DialogTitle>
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
              <Label>الهاتف</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <Button onClick={create} disabled={pending}>
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
