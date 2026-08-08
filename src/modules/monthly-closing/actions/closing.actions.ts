"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import {
  closePeriod,
  generateSnapshot,
  listClosings,
  reopenPeriod,
} from "@/modules/monthly-closing/services/closing.service";

export async function generateClosingAction(input: {
  storeId: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  await requireFeature("monthly_closing");
  const user = await requirePermissionOrRole("monthly_closing_manage", ["owner", "manager"]);
  const closing = await generateSnapshot({ ...input, userId: user.id });
  revalidatePath("/monthly-closing");
  return closing;
}

export async function closePeriodAction(closingId: string) {
  await requireFeature("monthly_closing");
  const user = await requirePermissionOrRole("monthly_closing_manage", ["owner", "manager"]);
  await closePeriod(closingId, user.id);
  revalidatePath("/monthly-closing");
}

export async function reopenPeriodAction(closingId: string) {
  await requireFeature("monthly_closing");
  const user = await requirePermissionOrRole("monthly_closing_reopen", ["owner"]);
  await reopenPeriod(closingId, user.id);
  revalidatePath("/monthly-closing");
}

export async function getClosingData() {
  await requireFeature("monthly_closing");
  await requirePermissionOrRole("monthly_closing_manage", ["owner", "manager"]);
  const org = await orgRepo.getOrganization();
  const storeId = await getValidatedActiveStoreId();
  return {
    closings: await listClosings(),
    stores: await storeRepo.listStores(),
    storeId,
    currency: org.currency,
  };
}
