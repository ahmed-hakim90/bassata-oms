import { notFound } from "next/navigation";
import { PlatformCompanyDetail } from "@/modules/platform/components/platform-ui";
import { getPlatformSupportSession } from "@/lib/platform/support-session";
import { getCompany } from "@/modules/platform/services/platform.service";

export default async function PlatformCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [company, supportSession] = await Promise.all([
    getCompany(id),
    getPlatformSupportSession(),
  ]);
  if (!company) notFound();
  return <PlatformCompanyDetail company={company} supportSession={supportSession} />;
}
