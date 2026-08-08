import { notFound } from "next/navigation";
import { PosScreen } from "@/modules/pos/components/pos-screen";
import { getPosPageData } from "@/modules/pos/services/pos-page-data.service";
import { bindPosStoreFromSlug } from "@/modules/auth/services/pos-pin-login.service";
import {
  buildPosPathForSlug,
  isReservedPosSlug,
  resolveStoreByPosSlug,
} from "@/lib/tenancy/pos-store-slug";

export default async function StoreSlugPosPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug: rawSlug } = await params;
  if (isReservedPosSlug(rawSlug)) notFound();

  const store = await resolveStoreByPosSlug(rawSlug);
  if (!store) notFound();

  const bound = await bindPosStoreFromSlug(store.slug);
  if (!bound.ok && bound.reason === "slug_invalid") notFound();

  const data = await getPosPageData();
  const posPath = buildPosPathForSlug(store.slug);

  return (
    <PosScreen
      {...data}
      posPath={posPath}
      storeSlug={store.slug}
      storeLabel={store.name}
    />
  );
}
