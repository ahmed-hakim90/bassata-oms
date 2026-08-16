"use client";

import Link from "next/link";
import {
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileBadge,
  FileSpreadsheet,
  Heart,
  Landmark,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { HubAnalyticsSection } from "@/modules/module-hubs/components/hub-analytics-section";
import type { ModuleHubDefinition, ModuleHubLink } from "@/modules/module-hubs/lib/module-hub-catalog";
import type { HubAnalyticsPayload } from "@/modules/module-hubs/lib/hub-analytics-types";

const HUB_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileBadge,
  FileSpreadsheet,
  Heart,
  Landmark,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
};

interface ModuleHubViewProps {
  hub: Pick<
    ModuleHubDefinition,
    "title" | "description" | "breadcrumb" | "ctaLabel"
  >;
  links: ModuleHubLink[];
  analytics?: HubAnalyticsPayload | null;
}

export function ModuleHubView({ hub, links, analytics }: ModuleHubViewProps) {
  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <PageHeader
        breadcrumb={<span>{hub.breadcrumb}</span>}
        title={hub.title}
        description={hub.description}
      />

      {analytics ? <HubAnalyticsSection analytics={analytics} /> : null}

      {links.length === 0 ? (
        <EmptyStateBlock
          title="مفيش شاشات متاحة"
          description="مش عندك صلاحية تفتح عناصر المجموعة دي، أو الخصائص مقفولة من الإعدادات."
        />
      ) : (
        <section aria-label="شاشات الموديول" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            اختَر الشاشة
          </h2>
          <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => {
              const Icon = HUB_ICONS[link.icon] ?? ClipboardList;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block h-full rounded-[var(--mds-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <OperationalCard
                    title={link.label}
                    description={link.description}
                    className="h-full cursor-pointer transition-shadow group-hover:shadow-[var(--mds-elevation-2)] group-focus-visible:shadow-[var(--mds-elevation-2)]"
                  >
                    <div className="flex items-center gap-[var(--mds-space-3)] text-primary">
                      <Icon className="size-5 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">{hub.ctaLabel}</span>
                    </div>
                  </OperationalCard>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
