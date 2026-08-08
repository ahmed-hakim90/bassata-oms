"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlatformOrgOption } from "@/modules/platform/services/platform-users.service";
import type { BroadcastAudience } from "@/modules/platform/services/platform-marketing.service";
import { sendPlatformBroadcastAction } from "@/modules/platform/actions/platform.actions";

export function PlatformMarketingConsole({ orgs }: { orgs: PlatformOrgOption[] }) {
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<BroadcastAudience>("all_owners");
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const needsOrg = audience === "org_owners" || audience === "org_users";

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="رسائل المنصة"
      />

      <OperationalCard title="إرسال رسالة">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await sendPlatformBroadcastAction({
                audience,
                orgId: needsOrg ? orgId : undefined,
                subject,
                body,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(
                `تم: ${result.data.sent} نجح · ${result.data.skipped} تخطي · ${result.data.failed} فشل (من ${result.data.attempted})`
              );
              setSubject("");
              setBody("");
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الجمهور</Label>
              <Select
                value={audience}
                onValueChange={(value) => {
                  if (value) setAudience(value as BroadcastAudience);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_owners">كل ملاك الشركات النشطة</SelectItem>
                  <SelectItem value="org_owners">ملاك شركة محددة</SelectItem>
                  <SelectItem value="org_users">كل مستخدمي شركة محددة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsOrg ? (
              <div className="space-y-1.5">
                <Label>الشركة</Label>
                <Select
                  value={orgId || undefined}
                  onValueChange={(value) => {
                    if (value) setOrgId(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختار شركة" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-subject">العنوان</Label>
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-body">المحتوى</Label>
            <textarea
              id="broadcast-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={5}
              rows={8}
              className="w-full rounded-[var(--mds-radius-md)] border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
          <Button type="submit" disabled={pending || (needsOrg && !orgId)}>
            <Send className="size-3.5" />
            إرسال الآن
          </Button>
        </form>
      </OperationalCard>
    </div>
  );
}
