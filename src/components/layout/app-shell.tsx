import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import type { Store } from "@/lib/types";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppShellHeader } from "@/components/layout/app-shell-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SessionBar } from "@/components/layout/session-bar";
import type { PosReadinessState } from "@/lib/auth/pos-readiness";

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  stores?: Store[];
  activeStoreId?: string | null;
  permissions?: Set<PermissionKey>;
  posReadinessState?: PosReadinessState;
}

export function AppShell({
  children,
  userRole,
  userName,
  featureFlags,
  stores = [],
  activeStoreId = null,
  permissions = new Set(),
  posReadinessState,
}: AppShellProps) {
  return (
    <div className="flex h-full bg-background">
      <div className="hidden overflow-hidden h-full shrink-0 md:flex">
        <AppSidebar userRole={userRole} featureFlags={featureFlags} permissions={permissions} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppShellHeader
          userName={userName}
          stores={stores}
          activeStoreId={activeStoreId}
          featureFlags={featureFlags}
          posReadinessState={posReadinessState}
        />
        <SessionBar />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav userRole={userRole} featureFlags={featureFlags} permissions={permissions} />
    </div>
  );
}
