"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Landmark, Plus, Search } from "lucide-react";
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
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { SupplierListSummary } from "@/lib/types";
import { createSupplierFromSuppliersAction } from "@/modules/suppliers/actions/supplier.actions";

interface SuppliersPageProps {
  summaries: SupplierListSummary[];
  currency: string;
}

export function SuppliersPage({ summaries: initial, currency }: SuppliersPageProps) {
  const [summaries, setSummaries] = useState(initial);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", contact_info: "" });

  const filtered = summaries.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_info.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayables = useMemo(
    () => summaries.reduce((sum, s) => sum + Math.max(0, s.balanceDue), 0),
    [summaries]
  );

  const create = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const result = await createSupplierFromSuppliersAction({
        name: form.name.trim(),
        contact_info: form.contact_info.trim(),
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
          balanceDue: 0,
          invoiceCount: 0,
          lastActivityAt: null,
        },
        ...summaries,
      ]);
      setShowCreate(false);
      setForm({ name: "", contact_info: "" });
      toast.success("Supplier created");
    });
  };

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Vendor balances and account statements"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Add Supplier
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total payables"
          value={formatCurrency(totalPayables, currency)}
          icon={<Landmark className="size-5" />}
        />
        <KpiCard label="Suppliers" value={String(summaries.length)} />
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <OperationalCard title="No suppliers found">
          <div className="flex flex-col items-center py-12">
            <Landmark className="mb-4 size-12 text-muted-foreground" />
            <Button onClick={() => setShowCreate(true)}>Add Supplier</Button>
          </div>
        </OperationalCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.id} href={`/inventory/suppliers/${s.id}`}>
              <OperationalCard className="transition-all hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.contact_info ? (
                      <p className="truncate text-sm text-muted-foreground">{s.contact_info}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.invoiceCount} received invoice{s.invoiceCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatCurrency(s.balanceDue, currency)}</p>
                    <p className="text-xs text-muted-foreground">balance due</p>
                  </div>
                </div>
                {s.lastActivityAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last activity {formatDateTime(s.lastActivityAt)}
                  </p>
                ) : null}
              </OperationalCard>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>New Supplier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="Email or phone"
              />
            </div>
            <Button onClick={create} disabled={pending}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
