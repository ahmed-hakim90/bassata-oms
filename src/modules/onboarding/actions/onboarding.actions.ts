"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_COOKIE } from "@/lib/auth/session";
import {
  initializeOrganization,
  OwnerEmailAlreadyUsedError,
} from "@/modules/onboarding/services/bootstrap.service";
import {
  onboardingPayloadSchema,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

export interface CompleteOnboardingResult {
  success: boolean;
  error?: string;
}

export async function completeOnboardingAction(
  payload: OnboardingPayload
): Promise<CompleteOnboardingResult> {
  const parsed = onboardingPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid onboarding data.",
    };
  }

  try {
    const result = await initializeOrganization(parsed.data);
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.ownerEmail,
      password: parsed.data.owner.password,
    });
    if (signInError) {
      return {
        success: false,
        error: "Store created but sign-in failed. Please log in manually.",
      };
    }

    const cookieStore = await cookies();
    cookieStore.set(STORE_COOKIE, result.storeId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    redirect("/");
  } catch (error) {
    if (error instanceof OwnerEmailAlreadyUsedError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Onboarding failed.",
    };
  }
}
