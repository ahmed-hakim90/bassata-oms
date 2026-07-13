import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import type { Store } from "@/lib/types";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppShellHeader } from "@/components/layout/app-shell-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SessionBar } from "@/components/layout/session-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import type { PosReadinessState } from "@/lib/auth/pos-readiness";

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  stores?: Store[];
  activeStoreId?: string | null;
  permissions?: PermissionKey[];
  posReadinessState?: PosReadinessState;
}

export function AppShell({
  children,
  userRole,
  userName,
  featureFlags,
  stores = [],
  activeStoreId = null,
  permissions = [],
  posReadinessState,
}: AppShellProps) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[var(--mds-color-bg-canvas)]">
      <div className="hidden h-full min-h-0 shrink-0 overflow-hidden md:flex">
        <AppSidebar userRole={userRole} featureFlags={featureFlags} permissions={permissions} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppShellHeader
          userName={userName}
          userRole={userRole}
          stores={stores}
          activeStoreId={activeStoreId}
          featureFlags={featureFlags}
          posReadinessState={posReadinessState}
          permissions={permissions}
        />
        <SessionBar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--mds-color-bg-canvas)] p-[var(--mds-space-4)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-[var(--mds-space-6)] md:pb-[var(--mds-space-8)]">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <MobileNav userRole={userRole} featureFlags={featureFlags} permissions={permissions} />
      <CommandPalette
        userRole={userRole}
        permissions={permissions}
        featureFlags={featureFlags}
      />
    </div>
  );
}
