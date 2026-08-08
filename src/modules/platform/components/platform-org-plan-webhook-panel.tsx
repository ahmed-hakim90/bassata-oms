"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_PLAN_PRESETS,
  type PlatformPlan,
  type PlatformPlanId,
  type PlatformUsage,
} from "@/modules/platform/services/platform-plan.service";
import {
  PLATFORM_WEBHOOK_EVENTS,
  type PlatformWebhookConfig,
  type PlatformWebhookEvent,
} from "@/modules/platform/services/platform-webhooks.service";
import {
  setPlatformPlanAction,
  setPlatformWebhookConfigAction,
} from "@/modules/platform/actions/platform.actions";

const PLAN_LABELS: Record<PlatformPlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  custom: "مخصص",
};

function limitLabel(value: number | null): string {
  return value == null ? "∞" : String(value);
}

export function PlatformOrgPlanWebhookPanel(props: {
  orgId: string;
  plan: PlatformPlan;
  usage: PlatformUsage;
  webhook: PlatformWebhookConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState<PlatformPlanId>(props.plan.plan);
  const [maxStores, setMaxStores] = useState(
    props.plan.max_stores == null ? "" : String(props.plan.max_stores)
  );
  const [maxUsers, setMaxUsers] = useState(
    props.plan.max_users == null ? "" : String(props.plan.max_users)
  );
  const [maxDevices, setMaxDevices] = useState(
    props.plan.max_devices == null ? "" : String(props.plan.max_devices)
  );
  const [notes, setNotes] = useState(props.plan.notes);
  const [allowCustomDomain, setAllowCustomDomain] = useState(
    props.plan.allow_custom_domain
  );

  const [webhookEnabled, setWebhookEnabled] = useState(props.webhook.enabled);
  const [webhookUrl, setWebhookUrl] = useState(props.webhook.url);
  const [webhookEvents, setWebhookEvents] = useState<PlatformWebhookEvent[]>(
    props.webhook.events
  );
  const [revealedSecret, setRevealedSecret] = useState(props.webhook.secret);

  function applyPlanPreset(next: PlatformPlanId) {
    setPlanId(next);
    if (next === "custom") return;
    const preset = PLATFORM_PLAN_PRESETS[next];
    setMaxStores(preset.max_stores == null ? "" : String(preset.max_stores));
    setMaxUsers(preset.max_users == null ? "" : String(preset.max_users));
    setMaxDevices(preset.max_devices == null ? "" : String(preset.max_devices));
    setAllowCustomDomain(preset.allow_custom_domain);
  }

  return (
    <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
      <OperationalCard
        title="الباقة والحدود"
      >
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <StatusPill
            label={`فروع ${props.usage.stores}/${limitLabel(props.plan.max_stores)}`}
            variant="default"
          />
          <StatusPill
            label={`مستخدمين ${props.usage.users}/${limitLabel(props.plan.max_users)}`}
            variant="default"
          />
          <StatusPill
            label={`سجلات ${props.usage.devices}/${limitLabel(props.plan.max_devices)}`}
            variant="default"
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الباقة</Label>
            <Select
              value={planId}
              onValueChange={(value) => {
                if (value) applyPlanPreset(value as PlatformPlanId);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLAN_LABELS) as PlatformPlanId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {PLAN_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>أقصى فروع</Label>
              <Input
                value={maxStores}
                onChange={(e) => {
                  setPlanId("custom");
                  setMaxStores(e.target.value);
                }}
                placeholder="∞"
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label>أقصى مستخدمين</Label>
              <Input
                value={maxUsers}
                onChange={(e) => {
                  setPlanId("custom");
                  setMaxUsers(e.target.value);
                }}
                placeholder="∞"
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label>أقصى سجلات تشغيل</Label>
              <Input
                value={maxDevices}
                onChange={(e) => {
                  setPlanId("custom");
                  setMaxDevices(e.target.value);
                }}
                placeholder="∞"
                dir="ltr"
                className="text-start"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allowCustomDomain}
              onCheckedChange={(checked) => {
                setPlanId("custom");
                setAllowCustomDomain(checked === true);
              }}
            />
            السماح بدومين مخصص (white-label)
          </label>
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await setPlatformPlanAction({
                  orgId: props.orgId,
                  plan: {
                    plan: planId,
                    max_stores: maxStores.trim() === "" ? null : Number(maxStores),
                    max_users: maxUsers.trim() === "" ? null : Number(maxUsers),
                    max_devices:
                      maxDevices.trim() === "" ? null : Number(maxDevices),
                    allow_custom_domain: allowCustomDomain,
                    notes,
                  },
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("تم حفظ الباقة");
                router.refresh();
              });
            }}
          >
            حفظ الباقة
          </Button>
        </div>
      </OperationalCard>

      <OperationalCard
        title="Webhooks"
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={webhookEnabled}
              onCheckedChange={(v) => setWebhookEnabled(v === true)}
            />
            تفعيل Webhook
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/hooks/velora"
              dir="ltr"
              className="text-start"
            />
          </div>
          <div className="space-y-1.5">
            <Label>السر (X-Velora-Signature)</Label>
            <Input value={revealedSecret || "—"} readOnly dir="ltr" className="text-start" />
          </div>
          <div className="space-y-2">
            <Label>الأحداث</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {PLATFORM_WEBHOOK_EVENTS.map((event) => {
                const checked = webhookEvents.includes(event);
                return (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setWebhookEvents((prev) =>
                          v === true
                            ? [...new Set([...prev, event])]
                            : prev.filter((e) => e !== event)
                        );
                      }}
                    />
                    <span dir="ltr">{event}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await setPlatformWebhookConfigAction({
                    orgId: props.orgId,
                    enabled: webhookEnabled,
                    url: webhookUrl,
                    events: webhookEvents,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setRevealedSecret(result.data.secret);
                  toast.success("تم حفظ الـ webhook");
                  router.refresh();
                });
              }}
            >
              حفظ Webhook
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await setPlatformWebhookConfigAction({
                    orgId: props.orgId,
                    enabled: webhookEnabled,
                    url: webhookUrl,
                    events: webhookEvents,
                    rotateSecret: true,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setRevealedSecret(result.data.secret);
                  toast.success("تم تدوير السر");
                  router.refresh();
                });
              }}
            >
              تدوير السر
            </Button>
          </div>
        </div>
      </OperationalCard>
    </div>
  );
}
