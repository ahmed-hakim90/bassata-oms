"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { PlatformInviteRow } from "@/modules/platform/services/platform-invite.service";
import {
  createCompanyInviteAction,
  revokeCompanyInviteAction,
} from "@/modules/platform/actions/platform.actions";

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

export function PlatformInvitesConsole({ invites }: { invites: PlatformInviteRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
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
        title="دعوات الشركات"
        description="إنشاء وإلغاء دعوات onboarding للشركات الجديدة."
      />

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <OperationalCard title="دعوة شركة جديدة">
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

        <OperationalCard title="كل الدعوات">
          {invites.length === 0 ? (
            <EmptyStateBlock
              title="مفيش دعوات"
              description="أنشئ دعوة من النموذج المجاور."
            />
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
