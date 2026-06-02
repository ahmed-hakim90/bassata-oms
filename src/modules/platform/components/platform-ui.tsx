import Link from "next/link";
import type React from "react";
import { Building2, Database, HardDrive, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCompanyInviteAction,
  endSupportViewAction,
  reassignCompanyOwnerAction,
  reissueCompanyInviteAction,
  revokeCompanyInviteAction,
  startSupportViewAction,
  updateCompanyAction,
} from "@/modules/platform/actions/platform.actions";
import type {
  PlatformCompanySummary,
  PlatformInvite,
} from "@/modules/platform/services/platform.service";
import type { PlatformSupportSession } from "@/lib/platform/support-session";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadge(status: string) {
  return status === "active" ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="destructive">Suspended</Badge>
  );
}

export function PlatformDashboard({
  companies,
  invites,
  inviteLink,
}: {
  companies: PlatformCompanySummary[];
  invites: PlatformInvite[];
  inviteLink?: string;
}) {
  const totalDb = companies.reduce((sum, company) => sum + company.metrics.databaseBytes, 0);
  const totalStorage = companies.reduce((sum, company) => sum + company.metrics.storageBytes, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Platform</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Super Admin Console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Companies, owner invites, support access, and tenant data volume.
          </p>
        </div>
        <Badge variant="outline" className="h-7">
          <ShieldCheck className="size-3" /> Super admin
        </Badge>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Building2} label="Companies" value={String(companies.length)} />
        <MetricCard
          icon={UserPlus}
          label="Pending invites"
          value={String(invites.filter((invite) => invite.status === "pending").length)}
        />
        <MetricCard icon={Database} label="Estimated DB" value={formatBytes(totalDb)} />
        <MetricCard icon={HardDrive} label="Asset storage" value={formatBytes(totalStorage)} />
      </section>

      {inviteLink ? (
        <Card>
          <CardHeader>
            <CardTitle>New invite link</CardTitle>
          </CardHeader>
          <CardContent>
            <Input readOnly value={inviteLink} />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{company.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {company.country || "No country"} · {formatDate(company.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div>{company.ownerName ?? "No owner"}</div>
                        <div className="text-xs text-muted-foreground">{company.ownerEmail}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {company.metrics.orderCount} orders · {company.metrics.productCount} products
                        <br />
                        {formatBytes(company.metrics.databaseBytes)} DB ·{" "}
                        {formatBytes(company.metrics.storageBytes)} assets
                      </td>
                      <td className="py-3 pr-4">{statusBadge(company.status)}</td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/platform/companies/${company.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No companies yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create owner invite</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createCompanyInviteAction} className="space-y-3">
                <Input name="orgName" placeholder="Company name" required minLength={2} />
                <Input name="ownerName" placeholder="Owner name" required minLength={2} />
                <Input name="ownerEmail" placeholder="owner@example.com" type="email" required />
                <Input name="expiresInDays" type="number" min={1} defaultValue={14} />
                <Button type="submit" className="w-full">
                  Create invite
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent invites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{invite.orgName}</div>
                      <div className="text-xs text-muted-foreground">{invite.ownerEmail}</div>
                    </div>
                    <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>
                      {invite.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Expires {formatDate(invite.expiresAt)}
                  </div>
                  {invite.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <form action={reissueCompanyInviteAction}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Reissue
                        </Button>
                      </form>
                      <form action={revokeCompanyInviteAction}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Revoke
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invites yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformCompanyDetail({
  company,
  supportSession,
}: {
  company: PlatformCompanySummary;
  supportSession: PlatformSupportSession | null;
}) {
  const supportActive = supportSession?.orgId === company.id;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/platform"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
          >
            Back to platform
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {company.ownerEmail ?? "No owner"} · {formatDate(company.createdAt)}
          </p>
        </div>
        {statusBadge(company.status)}
      </div>

      {supportActive ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <div className="font-medium">View-only support mode is active</div>
          <div className="mt-1 text-muted-foreground">Reason: {supportSession.reason}</div>
          <form action={endSupportViewAction} className="mt-3">
            <input type="hidden" name="orgId" value={company.id} />
            <Button type="submit" variant="outline" size="sm">
              End support view
            </Button>
          </form>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Building2} label="Stores" value={String(company.metrics.storeCount)} />
        <MetricCard icon={UserPlus} label="Users" value={String(company.metrics.userCount)} />
        <MetricCard icon={Database} label="Estimated DB" value={formatBytes(company.metrics.databaseBytes)} />
        <MetricCard icon={HardDrive} label="Assets" value={formatBytes(company.metrics.storageBytes)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Company controls</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCompanyAction} className="space-y-3">
              <input type="hidden" name="orgId" value={company.id} />
              <Input name="name" defaultValue={company.name} required minLength={2} />
              <div className="grid grid-cols-2 gap-3">
                <Input name="currency" defaultValue={company.currency} required />
                <Input name="country" defaultValue={company.country} />
              </div>
              <Input name="timezone" defaultValue={company.timezone} required />
              <select
                name="status"
                defaultValue={company.status}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <Button type="submit">Save company</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reassign owner</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={reassignCompanyOwnerAction} className="space-y-3">
              <input type="hidden" name="orgId" value={company.id} />
              <Input name="ownerName" placeholder="New owner name" required minLength={2} />
              <Input name="ownerEmail" type="email" placeholder="owner@example.com" required />
              <Input
                name="password"
                type="password"
                placeholder="Temporary password"
                required
                minLength={8}
              />
              <Button type="submit" variant="outline">
                Reassign owner
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Existing active owners are demoted to manager after the new owner account is created.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View-only support access</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={startSupportViewAction} className="space-y-3">
              <input type="hidden" name="orgId" value={company.id} />
              <Input
                name="reason"
                placeholder="Reason for opening this company"
                required
                minLength={3}
              />
              <Button type="submit" variant="outline">
                Start support view
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              This v1 support mode exposes platform-owned read-only company metrics only. Tenant
              mutations remain unavailable from this session.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Operational counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Count label="Products" value={company.metrics.productCount} />
            <Count label="Customers" value={company.metrics.customerCount} />
            <Count label="Orders" value={company.metrics.orderCount} />
            <Count label="Expenses" value={company.metrics.expenseCount} />
            <Count label="Purchases" value={company.metrics.purchaseCount} />
            <Count label="Inventory movements" value={company.metrics.inventoryMovementCount} />
            <Count label="Audit logs" value={company.metrics.auditLogCount} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
