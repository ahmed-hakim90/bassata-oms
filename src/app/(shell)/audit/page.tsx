import { redirect } from "next/navigation";

export default async function AuditRoute({
  searchParams,
}: {
  searchParams: Promise<{
    storeId?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams({ tab: "audit" });
  if (params.storeId) q.set("storeId", params.storeId);
  if (params.userId) q.set("userId", params.userId);
  if (params.action) q.set("action", params.action);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.page) q.set("page", params.page);
  redirect(`/settings?${q.toString()}`);
}
