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
  acceptCompanyInvite,
  getPendingInviteByToken,
} from "@/modules/platform/services/platform.service";
import {
  onboardingPayloadSchema,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

export interface CompleteOnboardingResult {
  success: boolean;
  error?: string;
}

export async function completeOnboardingAction(
  payload: OnboardingPayload,
  inviteToken: string
): Promise<CompleteOnboardingResult> {
  if (!inviteToken) {
    return {
      success: false,
      error: "A valid company invite is required.",
    };
  }
  const parsed = onboardingPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid onboarding data.",
    };
  }

  try {
    const invite = await getPendingInviteByToken(inviteToken);
    if (!invite) {
      return {
        success: false,
        error: "Company invite is invalid or expired.",
      };
    }
    if (invite.ownerEmail !== parsed.data.owner.email.trim().toLowerCase()) {
      return {
        success: false,
        error: "Owner email must match the company invite.",
      };
    }

    const result = await initializeOrganization(parsed.data);
    await acceptCompanyInvite({
      token: inviteToken,
      orgId: result.orgId,
      ownerEmail: result.ownerEmail,
    });
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
    if (err instanceof OwnerEmailAlreadyUsedError) {
      return {
        success: false,
        error: "Owner email is already used by another company.",
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onboarding failed.",
    };
  }

  redirect("/");
}
