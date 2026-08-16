"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { upsertSetting } from "@/modules/system/services/settings.service";
import {
  parsePrintEngineSettings,
  printEngineSettingsSchema,
  type PrintEngineSettings,
} from "@/modules/print-engine/lib/print-engine-settings";
import { getPrintEngineSettings } from "@/modules/print-engine/services/print-engine.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";

export async function getPrintEngineStudioDataAction() {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const [settings, branding] = await Promise.all([
    getPrintEngineSettings(),
    getReportBranding(),
  ]);
  return { settings, branding, generatedBy: user.name };
}

export async function savePrintEngineSettingsAction(
  input: unknown
): Promise<{ ok: true; data: PrintEngineSettings } | { ok: false; error: string }> {
  try {
    const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
    const parsed = printEngineSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "بيانات القالب غير صالحة" };
    }
    await upsertSetting(
      "print_engine",
      parsed.data as unknown as Record<string, unknown>,
      user.id
    );
    revalidatePath("/settings");
    revalidatePath("/print", "layout");
    return { ok: true, data: parsePrintEngineSettings(parsed.data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "تعذر حفظ محرك الطباعة",
    };
  }
}
