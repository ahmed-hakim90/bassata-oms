import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import type { Store } from "@/lib/types";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppShellHeader } from "@/components/layout/app-shell-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SessionBar } from "@/components/layout/session-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import type { PosReadinessState } from "@/lib/auth/pos-readiness";
import { ImplicitPosDeviceBinder } from "@/components/Velora/implicit-pos-device-binder";
import { RouteTransitionMain } from "@/components/layout/route-transition";

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  enableKitchenDisplay?: boolean;
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
  enableWholesaleSales,
  allowCashierWholesale,
  enableKitchenDisplay,
  stores = [],
  activeStoreId = null,
  permissions = [],
  posReadinessState,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-[var(--mds-color-bg-canvas)]">
      {posReadinessState ? <ImplicitPosDeviceBinder state={posReadinessState} /> : null}
      <div className="hidden shrink-0 md:block">
        <AppSidebar
          className="sticky top-0 h-dvh"
          userRole={userRole}
          featureFlags={featureFlags}
          enableWholesaleSales={enableWholesaleSales}
          allowCashierWholesale={allowCashierWholesale}
          enableKitchenDisplay={enableKitchenDisplay}
          permissions={permissions}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppShellHeader
          userName={userName}
          userRole={userRole}
          stores={stores}
          activeStoreId={activeStoreId}
          featureFlags={featureFlags}
          enableWholesaleSales={enableWholesaleSales}
          allowCashierWholesale={allowCashierWholesale}
          enableKitchenDisplay={enableKitchenDisplay}
          posReadinessState={posReadinessState}
          permissions={permissions}
        />
        <SessionBar />
        <main className="flex-1 bg-[var(--mds-color-bg-canvas)] p-[var(--mds-space-3)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-[var(--mds-space-4)] md:pb-[var(--mds-space-4)]">
          <div className="mx-auto w-full max-w-[1600px] pb-2 md:pb-0">
            <RouteTransitionMain>{children}</RouteTransitionMain>
          </div>
        </main>
      </div>

      <MobileNav
        userRole={userRole}
        featureFlags={featureFlags}
        enableWholesaleSales={enableWholesaleSales}
        allowCashierWholesale={allowCashierWholesale}
        enableKitchenDisplay={enableKitchenDisplay}
        permissions={permissions}
      />
      <CommandPalette
        userRole={userRole}
        permissions={permissions}
        featureFlags={featureFlags}
        enableWholesaleSales={enableWholesaleSales}
        allowCashierWholesale={allowCashierWholesale}
        enableKitchenDisplay={enableKitchenDisplay}
      />
    </div>
  );
}
