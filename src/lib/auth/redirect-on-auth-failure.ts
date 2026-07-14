import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/auth-error";

/** Layout-safe: expired/missing session → login instead of masked RSC crash. */
export function redirectOnAuthFailure(error: unknown, from?: string): never {
  if (error instanceof AuthError && error.status === 401) {
    redirect(from ? `/login?from=${encodeURIComponent(from)}` : "/login");
  }
  throw error;
}
