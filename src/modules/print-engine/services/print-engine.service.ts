import { getSetting } from "@/modules/system/services/settings.service";
import {
  DEFAULT_PRINT_ENGINE_SETTINGS,
  parsePrintEngineSettings,
  type PrintEngineSettings,
} from "@/modules/print-engine/lib/print-engine-settings";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export async function getPrintEngineSettings(): Promise<PrintEngineSettings> {
  const setting = await getSetting("print_engine");
  if (!setting) return DEFAULT_PRINT_ENGINE_SETTINGS;
  return parsePrintEngineSettings(setting.value);
}

export async function getCommercialPrintContext(storeId?: string): Promise<{
  branding: ReportBranding;
  settings: PrintEngineSettings;
}> {
  const [branding, settings] = await Promise.all([
    getReportBranding(storeId),
    getPrintEngineSettings(),
  ]);
  return { branding, settings };
}
