"use server";

import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { upsertSetting, listSettings } from "@/lib/repositories/organization.repository";
import { requireBarcodeLabelAccess } from "@/modules/reports/actions/report-access.actions";
import {
  DEFAULT_LABEL_SETTINGS,
  mergeLabelSettings,
  type LabelSettings,
} from "@/modules/reports/labels/label-settings";
import type { LabelStudioProduct } from "@/modules/reports/labels/print-job";

export async function getLabelPageData() {
  await requireBarcodeLabelAccess();
  const [org, products, categories, settings] = await Promise.all([
    orgRepo.getOrganization(),
    catalogRepo.listProducts({ activeOnly: true }),
    catalogRepo.listCategories(),
    listSettings(),
  ]);
  const activeProducts = products.filter((p) => p.is_active);
  const variantsByProduct = await catalogRepo.listVariantsForProducts(
    activeProducts.map((p) => p.id)
  );
  const studioProducts: LabelStudioProduct[] = activeProducts.map((product) => ({
    ...product,
    variants: (variantsByProduct.get(product.id) ?? []).filter((v) => v.is_active),
  }));
  const labelSetting = settings.find((s) => s.key === "label_settings");
  return {
    currency: org.currency,
    products: studioProducts,
    categories,
    settings: mergeLabelSettings(labelSetting?.value),
  };
}

export async function saveLabelSettingsAction(settings: LabelSettings) {
  await requireBarcodeLabelAccess();
  await upsertSetting("label_settings", settings as unknown as Record<string, unknown>);
  return { ok: true };
}

export async function getLabelSettingsAction(): Promise<LabelSettings> {
  await requireBarcodeLabelAccess();
  const settings = await listSettings();
  const labelSetting = settings.find((s) => s.key === "label_settings");
  return mergeLabelSettings(
    (labelSetting?.value ?? DEFAULT_LABEL_SETTINGS) as Record<string, unknown>
  );
}
