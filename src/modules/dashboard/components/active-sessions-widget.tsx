import Link from "next/link";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import {
  computeSessionLifecycle,
  formatSessionDuration,
} from "@/modules/sessions/services/session-lifecycle.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import type { CashierSession } from "@/lib/types";

interface ActiveSessionsWidgetProps {
  sessions: CashierSession[];
}

export async function ActiveSessionsWidget({
  sessions,
}: ActiveSessionsWidgetProps) {
  const [stores, users, settings] = await Promise.all([
    storeRepo.listStores(),
    userRepo.listUsers(),
    getSessionSettings(),
  ]);
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-5)] text-card-foreground shadow-[var(--mds-elevation-1)]">
      <div className="mb-[var(--mds-space-4)] flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">الجلسات المفتوحة</h3>
        <Link
          href="/sessions"
          className="text-xs font-medium text-primary hover:underline"
        >
          إدارة
        </Link>
      </div>
      {sessions.length === 0 ? (
        <EmptyStateBlock
          title="مفيش جلسات مفتوحة"
          className="p-[var(--mds-space-4)]"
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const lifecycle = computeSessionLifecycle(s, settings);
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-[var(--mds-radius-md)] bg-muted/40 px-[var(--mds-space-3)] py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{storeMap.get(s.store_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {userMap.get(s.cashier_id)} · {formatSessionDuration(lifecycle.hoursOpen)}
                  </p>
                </div>
                <SessionLifecycleBadge lifecycle={lifecycle.lifecycle} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
