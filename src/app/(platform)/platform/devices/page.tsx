import { redirect } from "next/navigation";

/** Device console retired from platform UI. */
export default function PlatformDevicesPage() {
  redirect("/platform/ops");
}
