"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LogOut, ShoppingCart } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { setActiveStoreAction } from "@/modules/auth/actions/set-store.action";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { selectLabelById } from "@/lib/select-label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { OpenSessionDialog } from "@/modules/sessions/components/open-session-dialog";
import type { FeatureFlag } from "@/lib/constants";
import type { Store } from "@/lib/types";
import type { PosReadinessState } from "@/lib/auth/pos-readiness";
import { useTranslation } from "@/lib/i18n/use-translation";

interface AppShellHeaderProps {
  userName: string;
  stores: Store[];
  activeStoreId: string | null;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  posReadinessState?: PosReadinessState;
}

export function AppShellHeader({
  userName,
  stores,
  activeStoreId,
  featureFlags,
  posReadinessState,
}: AppShellHeaderProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const selectedId = activeStoreId ?? stores[0]?.id;
  const canOpenSessionFromHeader = posReadinessState === "no_session";
  const needsCashierBeforeSession = posReadinessState === "cashier_required";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <p className="truncate text-sm text-muted-foreground md:hidden">{userName}</p>
      <p className="hidden truncate text-sm text-muted-foreground md:block">
        {t("Signed in as")} <span className="font-medium text-foreground">{userName}</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle darkModeEnabled={featureFlags?.dark_mode !== false} />
        {stores.length > 0 && (
          <Select
            value={selectedId}
            onValueChange={(storeId) => {
              if (!storeId) return;
              startTransition(async () => {
                await setActiveStoreAction(storeId);
              });
            }}
          >
            <SelectTrigger className="h-8 max-w-[11rem] rounded-full sm:max-w-[14rem]" disabled={pending}>
              <SelectValue placeholder={t("Select store")}>
                {(value) => selectLabelById(stores, value, (s) => s.name)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id} label={store.name}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Link
          href="/account"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "hidden rounded-full sm:inline-flex"
          )}
        >
          {t("Account")}
        </Link>
        {canOpenSessionFromHeader ? (
          <OpenSessionDialog
            redirectTo="/pos"
            triggerSize="sm"
            triggerClassName="rounded-full shadow-sm"
            triggerChildren={
              <>
                <ShoppingCart className="size-4" />
                <span className="hidden sm:inline">{t("Open session")}</span>
                <span className="sm:hidden">{t("Open session")}</span>
              </>
            }
          />
        ) : needsCashierBeforeSession ? (
          <Link
            href="/pos"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-sm")}
          >
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline">{t("Select cashier")}</span>
            <span className="sm:hidden">{t("Cashier")}</span>
          </Link>
        ) : (
          <Link
            href="/pos/start"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-sm")}
          >
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline">{t("Open POS")}</span>
            <span className="sm:hidden">{t("POS")}</span>
          </Link>
        )}
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm" className="rounded-full">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{t("Sign out")}</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
