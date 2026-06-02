import { SessionsPage } from "@/modules/sessions/components/sessions-page";

export default async function SessionsRoute({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const params = await searchParams;
  return <SessionsPage filterStoreId={params.storeId ?? "all"} />;
}
