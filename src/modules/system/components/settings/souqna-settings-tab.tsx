"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Badge } from "@/components/ui/badge";
import {
  listSouqnaLogsAction,
  publishAllProductsToSouqnaAction,
  regenerateSouqnaApiKeyAction,
  testSouqnaApiKeyAction,
  unpublishAllProductsFromSouqnaAction,
  updateSouqnaSettingsAction,
} from "@/modules/souqna/actions/souqna.actions";
import type {
  SouqnaIntegrationLog,
  SouqnaIntegrationStats,
  SouqnaPublicApiConfig,
  Store,
} from "@/lib/types";
import { buildSouqnaApiEndpoints } from "@/lib/souqna-api-url";

type PublicSouqnaSettings = {
  enable_souqna_channel: boolean;
  api_base_url: string;
  api_key_prefix: string;
  allowed_store_id: string | null;
  allow_order_import: boolean;
  reserve_stock_on_online_order: boolean;
  publish_products_to_souqna: boolean;
  enable_souqna_webhook: boolean;
  souqna_webhook_url: string;
  has_api_key: boolean;
  has_webhook_secret: boolean;
  api: SouqnaPublicApiConfig;
};

interface SouqnaSettingsTabProps {
  souqnaSettings: PublicSouqnaSettings;
  souqnaStats: SouqnaIntegrationStats;
  stores: Store[];
  initialLogs: SouqnaIntegrationLog[];
  initialLogsPage: number;
  initialLogsHasMore: boolean;
  migrationRequired?: boolean;
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "PPp");
}

export function SouqnaSettingsTab({
  souqnaSettings,
  souqnaStats,
  stores,
  initialLogs,
  initialLogsPage,
  initialLogsHasMore,
  migrationRequired = false,
}: SouqnaSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(souqnaSettings);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testApiKey, setTestApiKey] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [logsPage, setLogsPage] = useState(initialLogsPage);
  const [logsHasMore, setLogsHasMore] = useState(initialLogsHasMore);

  const previewApi = buildSouqnaApiEndpoints(form.api_base_url || souqnaSettings.api.api_base_url);

  function copyText(label: string, value: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
  }

  function save() {
    startTransition(async () => {
      try {
        const updated = await updateSouqnaSettingsAction({
          enable_souqna_channel: form.enable_souqna_channel,
          api_base_url: form.api_base_url,
          allowed_store_id: form.allowed_store_id,
          allow_order_import: form.allow_order_import,
          reserve_stock_on_online_order: form.reserve_stock_on_online_order,
          publish_products_to_souqna: form.publish_products_to_souqna,
          enable_souqna_webhook: form.enable_souqna_webhook,
          souqna_webhook_url: form.souqna_webhook_url,
          ...(webhookSecret.trim() ? { souqna_webhook_secret: webhookSecret.trim() } : {}),
        });
        setForm(updated);
        setWebhookSecret("");
        toast.success("Souqna settings saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save settings");
      }
    });
  }

  function regenerateKey() {
    startTransition(async () => {
      try {
        const result = await regenerateSouqnaApiKeyAction();
        setRevealedKey(result.apiKey);
        setForm((current) => ({
          ...current,
          api_key_prefix: result.apiKeyPrefix,
          has_api_key: true,
        }));
        toast.success("New API key generated — copy it now");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not regenerate key");
      }
    });
  }

  function testKey() {
    startTransition(async () => {
      try {
        const result = await testSouqnaApiKeyAction(testApiKey);
        toast.success(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "API key test failed");
      }
    });
  }

  function publishAll() {
    startTransition(async () => {
      try {
        await publishAllProductsToSouqnaAction();
        toast.success("All finished products marked for Souqna");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not publish products");
      }
    });
  }

  function unpublishAll() {
    startTransition(async () => {
      try {
        await unpublishAllProductsFromSouqnaAction();
        toast.success("All products removed from Souqna");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not unpublish products");
      }
    });
  }

  function loadMoreLogs() {
    startTransition(async () => {
      try {
        const nextPage = logsPage + 1;
        const result = await listSouqnaLogsAction(nextPage);
        setLogs((current) => [...current, ...result.logs]);
        setLogsPage(result.page);
        setLogsHasMore(result.hasMore);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load logs");
      }
    });
  }

  return (
    <div className="space-y-6">
      {migrationRequired ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Database migration required</p>
          <p className="mt-1">
            Souqna tables are not installed yet. Run migration{" "}
            <code className="rounded bg-amber-100 px-1">030_souqna_integration.sql</code> in
            Supabase SQL Editor, then refresh this page.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OperationalCard
          title="Published products"
          value={String(souqnaStats.published_products_count)}
          subtitle="Ready for Souqna sync"
        />
        <OperationalCard
          title="Imported orders"
          value={String(souqnaStats.imported_orders_count)}
          subtitle="From Souqna"
        />
        <OperationalCard
          title="Last products sync"
          value={formatWhen(souqnaStats.last_products_sync_at)}
          subtitle="GET /api/souqna/products"
        />
        <OperationalCard
          title="Last order import"
          value={formatWhen(souqnaStats.last_order_import_at)}
          subtitle="POST /api/souqna/orders"
        />
      </div>

      {souqnaStats.last_error_at ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Last integration error</p>
          <p className="mt-1 text-muted-foreground">{formatWhen(souqnaStats.last_error_at)}</p>
          {souqnaStats.last_error_message ? (
            <p className="mt-1">{souqnaStats.last_error_message}</p>
          ) : null}
        </div>
      ) : null}

      <OperationalCard
        title="Souqna Integration"
        description="Connect Souqna Marketplace to sync products and receive online orders."
      >
        <div className="grid max-w-lg gap-4">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_souqna_channel}
              onCheckedChange={(v) =>
                setForm({ ...form, enable_souqna_channel: v === true })
              }
            />
            <span className="text-sm">Enable Souqna channel</span>
          </label>

          <div className="space-y-2">
            <Label>Allowed store</Label>
            <Select
              value={form.allowed_store_id ?? ""}
              onValueChange={(value) =>
                setForm({ ...form, allowed_store_id: value || null })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select store for Souqna" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.allow_order_import}
              onCheckedChange={(v) =>
                setForm({ ...form, allow_order_import: v === true })
              }
            />
            <span className="text-sm">Allow order import from Souqna</span>
          </label>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.reserve_stock_on_online_order}
              onCheckedChange={(v) =>
                setForm({ ...form, reserve_stock_on_online_order: v === true })
              }
            />
            <span className="text-sm">Reserve stock on online order</span>
          </label>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.publish_products_to_souqna}
              onCheckedChange={(v) =>
                setForm({ ...form, publish_products_to_souqna: v === true })
              }
            />
            <span className="text-sm">Default new products to publish on Souqna</span>
          </label>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>API base URL</Label>
            <p className="text-sm text-muted-foreground">
              Put this base URL in Souqna. Use your production domain (HTTPS) for live sync.
            </p>
            <Input
              value={form.api_base_url}
              placeholder={souqnaSettings.api.api_base_url || "https://pos.example.com"}
              onChange={(e) => setForm({ ...form, api_base_url: e.target.value.trim() })}
            />
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Input readOnly value={previewApi.products_url} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!previewApi.products_url}
                  onClick={() => copyText("Products URL", previewApi.products_url)}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">GET products endpoint</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={previewApi.orders_url} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!previewApi.orders_url}
                  onClick={() => copyText("Orders URL", previewApi.orders_url)}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">POST orders endpoint</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={souqnaSettings.api.auth_header}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText("Auth header", souqnaSettings.api.auth_header)}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Authorization header format</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>API key</Label>
            <p className="text-sm text-muted-foreground">
              {form.has_api_key
                ? `Configured (${form.api_key_prefix}…)`
                : "No API key configured"}
            </p>
            {revealedKey ? (
              <div className="space-y-2">
                <Input readOnly value={revealedKey} className="font-mono text-xs" />
                <p className="text-xs text-amber-600">
                  Copy this key now. It will not be shown again.
                </p>
              </div>
            ) : null}
            <Button type="button" variant="outline" onClick={regenerateKey} disabled={pending}>
              {form.has_api_key ? "Regenerate API key" : "Generate API key"}
            </Button>
            {form.has_api_key ? (
              <div className="flex gap-2 pt-1">
                <Input
                  type="password"
                  placeholder="Paste API key to test"
                  value={testApiKey}
                  onChange={(e) => setTestApiKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || !testApiKey.trim()}
                  onClick={testKey}
                >
                  Test API key
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Order status webhook</Label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.enable_souqna_webhook}
                onCheckedChange={(v) =>
                  setForm({ ...form, enable_souqna_webhook: v === true })
                }
              />
              <span className="text-sm">Notify Souqna when order status changes</span>
            </label>
            <Input
              value={form.souqna_webhook_url}
              placeholder="https://souqna.example.com"
              onChange={(e) => setForm({ ...form, souqna_webhook_url: e.target.value.trim() })}
            />
            <p className="text-xs text-muted-foreground">
              POST to{" "}
              <code className="rounded bg-muted px-1">
                /api/integrations/store-system/order-status
              </code>
            </p>
            <Input
              type="password"
              placeholder={
                form.has_webhook_secret
                  ? "Webhook secret configured — enter new value to replace"
                  : "Webhook secret (optional)"
              }
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>

          <Button onClick={save} disabled={pending}>
            Save Souqna settings
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={publishAll} disabled={pending}>
              Publish all products to Souqna
            </Button>
            <Button type="button" variant="outline" onClick={unpublishAll} disabled={pending}>
              Unpublish all products from Souqna
            </Button>
          </div>
        </div>
      </OperationalCard>

      <OperationalCard title="Integration logs" description="Recent Souqna API activity">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No integration logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{log.direction}</Badge>
                  <Badge variant="outline">{log.request_type}</Badge>
                  {log.endpoint ? (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {log.endpoint}
                    </span>
                  ) : null}
                  <Badge
                    variant={
                      log.status === "success"
                        ? "default"
                        : log.status === "rejected"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {log.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {format(new Date(log.created_at), "PPp")}
                  </span>
                </div>
                {(log.error_message ?? log.error) ? (
                  <p className="mt-2 text-destructive">{log.error_message ?? log.error}</p>
                ) : null}
              </div>
            ))}
            {logsHasMore ? (
              <Button variant="outline" onClick={loadMoreLogs} disabled={pending}>
                Load more
              </Button>
            ) : null}
          </div>
        )}
      </OperationalCard>
    </div>
  );
}
