import { DevicePairForm } from "@/modules/auth/components/device-pair-form";

export default async function DevicePairPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return <DevicePairForm returnTo={from} />;
}
