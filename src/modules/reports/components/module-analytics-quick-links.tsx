"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { OperationalCard } from "@/components/Velora/operational-card";
import { cn } from "@/lib/utils";

export interface AnalyticsQuickLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface ModuleAnalyticsQuickLinksProps {
  title?: string;
  description?: string;
  links: AnalyticsQuickLink[];
  className?: string;
}

/**
 * Shared “glance → drill” link strip for module boards and report hubs.
 * Keep payloads tiny — links only, no aggregates.
 */
export function ModuleAnalyticsQuickLinks({
  title = "تحليل سريع",
  description,
  links,
  className,
}: ModuleAnalyticsQuickLinksProps) {
  if (links.length === 0) return null;

  return (
    <OperationalCard title={title} description={description} className={className}>
      <div
        className={cn(
          "grid gap-[var(--mds-space-3)] sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-start gap-3 rounded-[var(--mds-radius-md)] border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="mt-0.5 rounded-[var(--mds-radius-md)] bg-background p-2 text-primary shadow-sm">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{link.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </OperationalCard>
  );
}
