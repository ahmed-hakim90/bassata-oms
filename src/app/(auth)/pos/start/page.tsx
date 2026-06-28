import { redirect } from "next/navigation";
import { getCurrentUser, getRegisteredDeviceContext } from "@/lib/auth/session";

export default async function PosStartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/pos");
  if (user.role !== "cashier" && user.role !== "owner" && user.role !== "manager") {
    redirect("/");
  }

  if (user.store_ids.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        لا توجد صلاحية فرع مخصصة لك. تواصل مع المدير.
      </div>
    );
  }

  const device = await getRegisteredDeviceContext();
  redirect(device ? "/pos/resume" : "/device/pair?from=/pos");
}
