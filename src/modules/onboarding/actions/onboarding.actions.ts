"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { STORE_COOKIE } from "@/lib/auth/session";
import { isPlatformBootstrapEmail } from "@/lib/platform/bootstrap";
import {
  deploymentHasOrganization,
  initializeOrganization,
  OrganizationAlreadyExistsError,
} from "@/modules/onboarding/services/bootstrap.service";
import {
  onboardingPayloadSchema,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

export async function getOnboardingAccess(): Promise<{
  canAccess: boolean;
  hasOrganization: boolean;
  isBootstrapAdmin: boolean;
}> {
  const hasOrganization = await deploymentHasOrganization();
  const user = await getCurrentUser();

  if (!hasOrganization) {
    return { canAccess: true, hasOrganization: false, isBootstrapAdmin: false };
  }

  const isBootstrapAdmin = Boolean(user?.email && isPlatformBootstrapEmail(user.email));
  return {
    canAccess: isBootstrapAdmin,
    hasOrganization: true,
    isBootstrapAdmin,
  };
}

export interface CompleteOnboardingResult {
  success: boolean;
  error?: string;
}

export async function completeOnboardingAction(
  payload: OnboardingPayload
): Promise<CompleteOnboardingResult> {
  const access = await getOnboardingAccess();
  if (!access.canAccess) {
    return { success: false, error: "Onboarding is not available." };
  }

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
        error: "Organization created but sign-in failed. Please log in manually.",
      };
    }

    const cookieStore = await cookies();
    cookieStore.set(STORE_COOKIE, result.storeId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (err) {
    if (err instanceof OrganizationAlreadyExistsError) {
      return {
        success: false,
        error: "An organization already exists. Onboarding cannot be completed again.",
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onboarding failed.",
    };
  }

  redirect("/");
}
