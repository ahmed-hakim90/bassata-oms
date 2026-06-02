"use client";

import { AuditLogsPage } from "@/modules/system/components/audit-logs-page";
import type { AppUser, AuditLog, Store } from "@/lib/types";

interface AuditSettingsTabProps {
  logs: AuditLog[];
  users: AppUser[];
  stores: Store[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialFilters: {
    storeId?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}

export function AuditSettingsTab(props: AuditSettingsTabProps) {
  return <AuditLogsPage {...props} embedded />;
}
