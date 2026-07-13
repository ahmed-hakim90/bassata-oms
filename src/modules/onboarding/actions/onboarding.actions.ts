"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClient } from "@/lib/supabase/server";
import { setActiveStoreCookie } from "@/lib/auth/session";
import {
  initializeOrganization,
  InviteTokenError,
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
      error: parsed.error.issues[0]?.message ?? "بيانات التجهيز غير صالحة.",
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
        error: "تم إنشاء الشركة، لكن تسجيل الدخول فشل. سجّل الدخول يدويًا.",
      };
    }

    await setActiveStoreCookie(result.storeId);

    redirect("/");
  } catch (error) {
    // redirect() throws; must not be swallowed by the catch below.
    if (isRedirectError(error)) throw error;
    if (error instanceof OwnerEmailAlreadyUsedError) {
      return { success: false, error: error.message };
    }
    if (error instanceof InviteTokenError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "فشل التجهيز.",
    };
  }
}
