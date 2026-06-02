import { redirect } from "next/navigation";
import { getCurrentUser, getRegisteredDeviceContext } from "@/lib/auth/session";
import { resumePosSessionForUser } from "@/lib/auth/resume-pos-session";

export default async function PosStartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/pos");
  if (user.role !== "cashier" && user.role !== "owner" && user.role !== "manager") {
    redirect("/");
  }

  if (user.store_ids.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        No branch access assigned. Ask a manager.
      </div>
    );
  }

  const device = await getRegisteredDeviceContext();
  const preferredStoreId = await resumePosSessionForUser(user);

  if (device && device.storeId !== preferredStoreId) {
    redirect("/device/pair?from=/pos");
  }

  redirect(device ? "/pos" : "/device/pair?from=/pos");
}
