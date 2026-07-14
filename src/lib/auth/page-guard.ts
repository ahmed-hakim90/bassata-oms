import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-error";
import {
  getValidatedActiveStoreId,
  requireAnyPermission,
  requireAuth,
} from "@/lib/auth/guards";
import type { PageAccessDenial } from "@/lib/auth/page-access";
import type { PermissionKey } from "@/lib/constants";
import type { AppUser } from "@/lib/types";

export type PageStoreResult =
  | { ok: true; storeId: string }
  | { ok: false; denial: PageAccessDenial };

export type PageAuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; denial: PageAccessDenial };

function loginRedirect(from?: string): never {
  redirect(from ? `/login?from=${encodeURIComponent(from)}` : "/login");
}

export function authErrorToDenial(error: AuthError): PageAccessDenial {
  const message = error.message.toLowerCase();
  if (
    message.includes("store") ||
    message.includes("no active store") ||
    message.includes("فرع")
  ) {
    return {
      title: "اختَر فرع",
      description: "مفيش فرع نشط متاح. اختَر فرع من القائمة وجرب تاني.",
    };
  }
  return {
    title: "مفيش صلاحية",
    description: "مش عندك صلاحية تفتح الصفحة دي. لو محتاج حاجة، كلّم المدير.",
  };
}

/**
 * Page-level store resolution: 401 → login redirect, other AuthError → AccessDenied props.
 * Use in Server Components instead of raw getValidatedActiveStoreId() throws.
 */
export async function requirePageStoreId(from?: string): Promise<PageStoreResult> {
  try {
    return { ok: true, storeId: await getValidatedActiveStoreId() };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) loginRedirect(from);
      return { ok: false, denial: authErrorToDenial(error) };
    }
    throw error;
  }
}

/** Catch AuthError from any async page bootstrap (permissions + store, etc.). */
export async function runPageAuth<T>(
  fn: () => Promise<T>,
  from?: string
): Promise<PageAuthResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) loginRedirect(from);
      return { ok: false, denial: authErrorToDenial(error) };
    }
    throw error;
  }
}

export async function requirePageAuth(from?: string): Promise<PageAuthResult<AppUser>> {
  return runPageAuth(() => requireAuth(), from);
}

export async function requirePageAnyPermission(
  keys: PermissionKey[],
  from?: string
): Promise<PageAuthResult<AppUser>> {
  return runPageAuth(() => requireAnyPermission(keys), from);
}
