import Link from "next/link";
import { Clock } from "lucide-react";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
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
    <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">Active sessions</h3>
        <Link
          href="/sessions"
          className="text-xs font-medium text-primary hover:underline"
        >
          Manage
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          No open sessions
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const lifecycle = computeSessionLifecycle(s, settings);
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
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
