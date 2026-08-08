import { ensureImplicitPosDeviceBinding } from "@/lib/auth/implicit-pos-device";
import type { AppUser } from "@/lib/types";

/** Pick store/device automatically so POS works without pairing UX. */
export async function preparePosEnvironment(user: AppUser): Promise<void> {
  await ensureImplicitPosDeviceBinding(user);
}
