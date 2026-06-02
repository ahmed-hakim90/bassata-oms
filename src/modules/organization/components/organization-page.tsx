import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { formatCurrency } from "@/lib/format";
import { getOrgOverviewStats } from "@/modules/organization/services/org-overview.service";
import * as orgRepo from "@/lib/repositories/organization.repository";

export async function OrganizationPage() {
  const [stats, org] = await Promise.all([getOrgOverviewStats(), orgRepo.getOrganization()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organization"
        description={`${stats.organizationName} — organization-wide overview`}
      />

      {org.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logo_url}
          alt={`${org.name} logo`}
          className="h-16 w-16 rounded-xl border border-border/60 object-cover"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Stores" value={String(stats.storeCount)} />
        <KpiCard label="Active stores" value={String(stats.activeStoreCount)} />
        <KpiCard label="Active users" value={String(stats.activeUsers)} />
        <KpiCard label="Active devices" value={String(stats.activeDevices)} />
        <KpiCard
          label="Today's sales (all stores)"
          value={formatCurrency(stats.todaySales, stats.currency)}
        />
        <KpiCard
          label="Inventory value"
          value={formatCurrency(stats.inventoryValue, stats.currency)}
        />
        <KpiCard
          label="Monthly profit (est.)"
          value={formatCurrency(stats.monthlyProfit, stats.currency)}
        />
      </div>
    </div>
  );
}
