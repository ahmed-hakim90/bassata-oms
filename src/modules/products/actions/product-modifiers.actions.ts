"use server";

import { revalidatePath } from "next/cache";
import {
  listActiveModifiersForPos,
  listProductModifierGroups,
  setModifierGroupActive,
  upsertModifier,
  upsertModifierGroup,
  type ProductModifierGroup,
} from "@/modules/products/services/product-modifiers.service";

export async function listProductModifierGroupsAction(
  productId: string
): Promise<ProductModifierGroup[]> {
  return listProductModifierGroups(productId);
}

export async function listActiveModifiersForPosAction(
  productId: string
): Promise<ProductModifierGroup[]> {
  return listActiveModifiersForPos(productId);
}

export async function upsertModifierGroupAction(input: {
  productId: string;
  groupId?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const id = await upsertModifierGroup(input);
    revalidatePath("/products");
    return { ok: true, id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل حفظ المجموعة",
    };
  }
}

export async function upsertModifierAction(input: {
  groupId: string;
  modifierId?: string;
  name: string;
  priceDelta: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const id = await upsertModifier(input);
    revalidatePath("/products");
    return { ok: true, id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل حفظ الإضافة",
    };
  }
}

export async function setModifierGroupActiveAction(
  groupId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setModifierGroupActive(groupId, isActive);
    revalidatePath("/products");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل التحديث",
    };
  }
}
