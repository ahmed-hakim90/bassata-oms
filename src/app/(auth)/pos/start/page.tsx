import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getRegisteredDeviceContext } from "@/lib/auth/session";
import { CashierStorePicker } from "@/modules/auth/components/cashier-store-picker";

export default async function PosStartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/pos");
  if (user.role !== "cashier" && user.role !== "owner" && user.role !== "manager") {
    redirect("/");
  }

  const allowedStores = user.store_ids;
  if (allowedStores.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        No branch access assigned. Ask a manager.
      </div>
    );
  }

  if (allowedStores.length === 1) {
    const { switchCashierStoreAction } = await import("@/modules/auth/actions/device.actions");
    await switchCashierStoreAction(allowedStores[0]!);
    const device = await getRegisteredDeviceContext();
    redirect(device ? "/pos" : "/device/pair?from=/pos");
  }

  const stores = await import("@/lib/repositories/store.repository").then((m) =>
    m.listStores()
  );
  const options = stores.filter((s) => allowedStores.includes(s.id));

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <CashierStorePicker stores={options} />
    </div>
  );
}
