"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgCustomDomain } from "@/modules/platform/services/platform-custom-domain.service";
import {
  setOrgCustomDomainAction,
  verifyOrgCustomDomainAction,
} from "@/modules/platform/actions/platform.actions";
import { getSiteUrl } from "@/lib/site-url";

const STATUS_LABEL: Record<OrgCustomDomain["status"], string> = {
  none: "لا يوجد",
  pending_dns: "بانتظار DNS",
  verifying: "جاري التحقق",
  active: "مفعّل",
  error: "خطأ في التحقق",
};

const STATUS_VARIANT: Record<
  OrgCustomDomain["status"],
  "default" | "success" | "warning" | "danger"
> = {
  none: "default",
  pending_dns: "warning",
  verifying: "warning",
  active: "success",
  error: "danger",
};

export function PlatformCustomDomainPanel(props: {
  orgId: string;
  domain: OrgCustomDomain;
  allowCustomDomain: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(props.domain.domain ?? "");
  const platformHost = (() => {
    try {
      return new URL(getSiteUrl()).host;
    } catch {
      return "your-app.vercel.app";
    }
  })();

  return (
    <OperationalCard title="الدومين المخصص (White-label)">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={STATUS_LABEL[props.domain.status]}
            variant={STATUS_VARIANT[props.domain.status]}
          />
          {!props.allowCustomDomain ? (
            <StatusPill label="الباقة لا تسمح بدومين" variant="danger" />
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          نفس الدومين يخدم الإدارة والـ POS ومنيو الأونلاين. بعد الحفظ: أضف الدومين في Vercel،
          وCNAME عند العميل، وروابط Auth في Supabase — التفاصيل في{" "}
          <span dir="ltr" className="font-mono text-xs">
            docs/CUSTOM_DOMAINS.md
          </span>
          .
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="custom-domain">Hostname</Label>
          <Input
            id="custom-domain"
            dir="ltr"
            className="text-start font-mono"
            placeholder="pos.client.com"
            value={value}
            disabled={pending || !props.allowCustomDomain}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div className="rounded-[var(--mds-radius-md)] border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">تعليمات DNS</p>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
            <li>
              CNAME من الدومين إلى{" "}
              <span dir="ltr" className="font-mono text-foreground">
                {platformHost}
              </span>{" "}
              (أو حسب تعليمات Vercel Domains)
            </li>
            <li>أضف نفس الـ hostname في مشروع Vercel → Domains</li>
            <li>
              أضف{" "}
              <span dir="ltr" className="font-mono text-xs">
                https://&lt;domain&gt;/auth/callback
              </span>{" "}
              في Supabase Auth Redirect URLs
            </li>
            <li>اضغط «تحقق الآن» بعد انتشار DNS</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || !props.allowCustomDomain}
            onClick={() => {
              startTransition(async () => {
                const result = await setOrgCustomDomainAction({
                  orgId: props.orgId,
                  domain: value.trim() || null,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("تم حفظ الدومين");
                router.refresh();
              });
            }}
          >
            حفظ
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !props.domain.domain || !props.allowCustomDomain}
            onClick={() => {
              startTransition(async () => {
                const result = await verifyOrgCustomDomainAction(props.orgId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  result.data?.status === "active"
                    ? "الدومين مفعّل"
                    : "التحقق فشل — راجع DNS"
                );
                router.refresh();
              });
            }}
          >
            تحقق الآن
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || !props.domain.domain}
            onClick={() => {
              startTransition(async () => {
                const result = await setOrgCustomDomainAction({
                  orgId: props.orgId,
                  domain: null,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setValue("");
                toast.success("تم إزالة الدومين");
                router.refresh();
              });
            }}
          >
            إزالة
          </Button>
        </div>
      </div>
    </OperationalCard>
  );
}
