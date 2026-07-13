import { notFound } from "next/navigation";
import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { SessionDetailPage } from "@/modules/sessions/components/session-detail-page";
import { getSessionDetail } from "@/modules/sessions/services/session-detail.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";

export const dynamic = "force-dynamic";

export default async function SessionDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await getValidatedActiveStoreId();
  const canViewAll = await permissionRepo.hasPermission("session_view_all");

  const detail = await getSessionDetail(id, {
    storeId,
    canViewAll,
  });
  if (!detail) notFound();

  const lifecycle =
    detail.session.status === "open"
      ? computeSessionLifecycle(detail.session, await getSessionSettings()).lifecycle
      : null;

  return <SessionDetailPage detail={detail} lifecycle={lifecycle} />;
}
