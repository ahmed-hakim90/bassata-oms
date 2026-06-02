import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getRegisteredDeviceContext } from "@/lib/auth/session";
import { resumePosSessionForUser } from "@/lib/auth/resume-pos-session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?from=/pos", request.url));
  }

  if (user.role !== "cashier" && user.role !== "owner" && user.role !== "manager") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user.store_ids.length === 0) {
    return NextResponse.redirect(new URL("/pos/start", request.url));
  }

  const device = await getRegisteredDeviceContext();
  const preferredStoreId = await resumePosSessionForUser(user);

  if (!device || device.storeId !== preferredStoreId) {
    return NextResponse.redirect(new URL("/device/pair?from=/pos", request.url));
  }

  return NextResponse.redirect(new URL("/pos", request.url));
}
