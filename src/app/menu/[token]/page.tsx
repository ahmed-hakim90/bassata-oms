import { notFound } from "next/navigation";
import { PublicMenuScreen } from "@/modules/online-menu/components/public-menu-screen";
import { getPublicMenu } from "@/modules/online-menu/services/public-menu.service";

export default async function PublicMenuRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const menu = await getPublicMenu(token);
  if (!menu) notFound();
  return <PublicMenuScreen menu={menu} token={token} />;
}
