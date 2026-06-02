"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { AppUser, AuditLog, Store } from "@/lib/types";

interface AuditLogsPageProps {
  logs: AuditLog[];
  users: AppUser[];
  stores: Store[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialFilters: {
    storeId?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  };
  embedded?: boolean;
}

export function AuditLogsPage({
  logs,
  users,
  stores,
  page,
  pageSize,
  hasMore,
  initialFilters,
  embedded,
}: AuditLogsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  function buildParams(form?: FormData, nextPage?: number) {
    const params = new URLSearchParams();
    if (embedded) params.set("tab", "audit");
    const storeId = form?.get("storeId")?.toString() ?? searchParams.get("storeId") ?? "";
    const userId = form?.get("userId")?.toString() ?? searchParams.get("userId") ?? "";
    const action = form?.get("action")?.toString() ?? searchParams.get("action") ?? "";
    const from = form?.get("from")?.toString() ?? searchParams.get("from") ?? "";
    const to = form?.get("to")?.toString() ?? searchParams.get("to")?.slice(0, 10) ?? "";
    if (storeId) params.set("storeId", storeId);
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(nextPage ?? 1));
    return params;
  }

  const auditPath = embedded ? "/settings" : "/audit";

  function applyFilters(form: FormData) {
    startTransition(() => {
      router.push(`${auditPath}?${buildParams(form, 1).toString()}`);
    });
  }

  return (
    <>
      {embedded ? null : (
        <PageHeader
          title="Audit Logs"
          description="Sensitive actions and system events"
        />
      )}

      <OperationalCard title="Filters">
        <form
          action={applyFilters}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="space-y-2">
            <Label>Action</Label>
            <select
              name="action"
              defaultValue={initialFilters.action ?? searchParams.get("action") ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>User</Label>
            <select
              name="userId"
              defaultValue={initialFilters.userId ?? searchParams.get("userId") ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Store</Label>
            <select
              name="storeId"
              defaultValue={initialFilters.storeId ?? searchParams.get("storeId") ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Input
              type="date"
              name="from"
              defaultValue={initialFilters.from?.slice(0, 10) ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              name="to"
              defaultValue={initialFilters.to?.slice(0, 10) ?? ""}
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" disabled={pending}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(embedded ? "/settings?tab=audit" : "/audit")
              }
            >
              Clear
            </Button>
          </div>
        </form>
      </OperationalCard>

      <OperationalCard title={`Recent Activity (page ${page})`}>
        {logs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No audit events match these filters
          </p>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.entity_type} · {log.entity_id}
                      {log.store_id
                        ? ` · ${storeMap.get(log.store_id) ?? log.store_id}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{userMap.get(log.user_id) ?? log.user_id}</p>
                    <p>{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Showing up to {pageSize} entries per page
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || pending}
              onClick={() =>
                startTransition(() =>
                  router.push(`${auditPath}?${buildParams(undefined, page - 1).toString()}`)
                )
              }
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasMore || pending}
              onClick={() =>
                startTransition(() =>
                  router.push(`${auditPath}?${buildParams(undefined, page + 1).toString()}`)
                )
              }
            >
              Next
            </Button>
          </div>
        </div>
      </OperationalCard>
    </>
  );
}
