import { redirect } from "next/navigation";

/** Pairing UX retired — browsers bind implicitly on login / POS. */
export default async function DevicePairPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/pos";
  redirect(target);
}
