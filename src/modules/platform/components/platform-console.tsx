"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Ban, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { PlatformOrganizationRow } from "@/modules/platform/services/platform-org.service";
import type { PlatformInviteRow } from "@/modules/platform/services/platform-invite.service";
import type { PlatformAuditLogRow } from "@/modules/platform/services/platform-audit.service";
import {
  createCompanyInviteAction,
  reactivateOrganizationAction,
  revokeCompanyInviteAction,
  suspendOrganizationAction,
} from "@/modules/platform/actions/platform.actions";

interface PlatformConsoleProps {
  organizations: PlatformOrganizationRow[];
  invites: PlatformInviteRow[];
  auditLogs: PlatformAuditLogRow[];
}

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "معلّقة",
  accepted: "مقبولة",
  revoked: "ملغاة",
  expired: "منتهية",
};

const INVITE_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  pending: "info",
  accepted: "success",
  revoked: "danger",
  expired: "warning",
};

export function PlatformConsole({
  organizations,
  invites,
  auditLogs,
}: PlatformConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<PlatformOrganizationRow | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PlatformInviteRow | null>(null);

  function refresh() {
    router.refresh();
  }

  function onCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCompanyInviteAction({
        orgName,
        ownerName: ownerName || undefined,
        ownerEmail,
        expiresInDays: Number(expiresInDays) || 14,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedToken(result.data.token);
      setOrgName("");
      setOwnerName("");
      setOwnerEmail("");
      toast.success("تم إنشاء الدعوة — انسخ التوكن دلوقتي، مش هيظهر تاني");
      refresh();
    });
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("تم نسخ التوكن");
    } catch {
      toast.error("مقدرناش ننسخ التوكن — انسخه يدوي");
    }
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="إدارة المنصة"
        description="تعليق الشركات، دعوات الإنضمام، وسجل إجراءات المنصة. مفيش دخول لحسابات المستأجرين من هنا."
      />

      <OperationalCard title="الشركات" description="تعليق الشركة يمنع تسجيل دخول مستخدميها.">
        {organizations.length === 0 ? (
          <EmptyStateBlock
            title="مفيش شركات لسه"
            description="لما تتأسس شركة من الدعوة، هتظهر هنا."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start font-medium">الاسم</th>
                  <th className="px-2 py-2 text-start font-medium">الحالة</th>
                  <th className="px-2 py-2 text-start font-medium">العملة</th>
                  <th className="px-2 py-2 text-start font-medium">تاريخ الإنشاء</th>
                  <th className="px-2 py-2 text-start font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const suspended = org.status === "suspended";
                  return (
                    <tr key={org.id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium">{org.name}</td>
                      <td className="px-2 py-3">
                        <StatusPill
                          label={suspended ? "معلّقة" : "نشطة"}
                          variant={suspended ? "danger" : "success"}
                        />
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{org.currency}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {formatDateTime(org.created_at)}
                      </td>
                      <td className="px-2 py-3">
                        {suspended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const result = await reactivateOrganizationAction(org.id);
                                if (!result.ok) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success("تم إعادة تفعيل الشركة");
                                refresh();
                              });
                            }}
                          >
                            <CheckCircle2 className="size-3.5" />
                            تفعيل
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => setConfirmSuspend(org)}
                          >
                            <Ban className="size-3.5" />
                            تعليق
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCard>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <OperationalCard title="دعوة شركة جديدة" description="التوكن يظهر مرة واحدة بس — انسخه وبعتّه للمالك.">
          <form onSubmit={onCreateInvite} className="space-y-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-org">اسم الشركة</Label>
              <Input
                id="invite-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="مثال: بساطة"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-owner-name">اسم المالك (اختياري)</Label>
              <Input
                id="invite-owner-name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="أحمد"
                autoComplete="name"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-owner-email">بريد المالك</Label>
              <Input
                id="invite-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                placeholder="owner@example.com"
                autoComplete="email"
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-ttl">الصلاحية (أيام)</Label>
              <Input
                id="invite-ttl"
                type="number"
                min={1}
                max={90}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                required
                inputMode="numeric"
              />
            </div>
            <Button type="submit" disabled={pending}>
              إنشاء دعوة
            </Button>
          </form>

          {createdToken ? (
            <div className="mt-[var(--mds-space-4)] rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-[var(--mds-space-3)]">
              <p className="mb-2 text-sm font-medium">توكن الدعوة (مرة واحدة)</p>
              <div className="flex items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs"
                  dir="ltr"
                >
                  {createdToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToken(createdToken)}
                >
                  <Copy className="size-3.5" />
                  نسخ
                </Button>
              </div>
            </div>
          ) : null}
        </OperationalCard>

        <OperationalCard title="الدعوات" description="آخر الدعوات المنشأة من المنصة.">
          {invites.length === 0 ? (
            <EmptyStateBlock title="مفيش دعوات" description="أنشئ دعوة من النموذج المجاور." />
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{invite.org_name}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {invite.owner_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      تنتهي: {formatDateTime(invite.expires_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill
                      label={INVITE_STATUS_LABEL[invite.status] ?? invite.status}
                      variant={INVITE_STATUS_VARIANT[invite.status] ?? "default"}
                    />
                    {invite.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setConfirmRevoke(invite)}
                      >
                        إلغاء
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      </div>

      <OperationalCard title="سجل المنصة" description="إجراءات التحكم (تعليق، دعوات، …).">
        {auditLogs.length === 0 ? (
          <EmptyStateBlock title="مفيش أحداث لسه" description="أي إجراء من اللوحة هيتسجّل هنا." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start font-medium">الوقت</th>
                  <th className="px-2 py-2 text-start font-medium">الإجراء</th>
                  <th className="px-2 py-2 text-start font-medium">الكيان</th>
                  <th className="px-2 py-2 text-start font-medium">المعرّف</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/60">
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-2 py-2 font-medium">{log.action}</td>
                    <td className="px-2 py-2">{log.entity_type}</td>
                    <td className="px-2 py-2 font-mono text-xs" dir="ltr">
                      {log.entity_id.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCard>

      <ConfirmActionDialog
        open={Boolean(confirmSuspend)}
        onOpenChange={(open) => {
          if (!open) setConfirmSuspend(null);
        }}
        title="تعليق الشركة؟"
        description={
          confirmSuspend
            ? `هيتمنع كل مستخدمي «${confirmSuspend.name}» من تسجيل الدخول لحد ما تعيد التفعيل.`
            : ""
        }
        confirmLabel="تعليق"
        destructive
        onConfirm={async () => {
          if (!confirmSuspend) return;
          const result = await suspendOrganizationAction(confirmSuspend.id);
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success("تم تعليق الشركة");
          refresh();
        }}
      />

      <ConfirmActionDialog
        open={Boolean(confirmRevoke)}
        onOpenChange={(open) => {
          if (!open) setConfirmRevoke(null);
        }}
        title="إلغاء الدعوة؟"
        description={
          confirmRevoke
            ? `هتلغي دعوة «${confirmRevoke.org_name}» لـ ${confirmRevoke.owner_email}.`
            : ""
        }
        confirmLabel="إلغاء الدعوة"
        destructive
        onConfirm={async () => {
          if (!confirmRevoke) return;
          const result = await revokeCompanyInviteAction(confirmRevoke.id);
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success("تم إلغاء الدعوة");
          refresh();
        }}
      />
    </div>
  );
}
