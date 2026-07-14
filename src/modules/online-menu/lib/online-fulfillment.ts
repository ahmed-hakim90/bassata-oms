import { roundMoney } from "@/lib/money";
/**
 * First-party pickup/delivery + zone fees in `stores.settings` (JSON only).
 *
 * Shape:
 *   online_fulfillment: {
 *     pickupEnabled: boolean      // default true
 *     deliveryEnabled: boolean    // default false
 *     zones: [{ id, name, fee }]  // delivery areas
 *   }
 *
 * Fees are always resolved server-side from this config — never trust client amounts.
 */

export type OnlineFulfillmentType = "pickup" | "delivery";

export type OnlineDeliveryZone = {
  id: string;
  name: string;
  fee: number;
};

export type OnlineFulfillmentConfig = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  zones: OnlineDeliveryZone[];
};

export type ResolveOnlineFulfillmentInput = {
  fulfillmentType: OnlineFulfillmentType;
  zoneId?: string | null;
  deliveryAddress?: string | null;
};

export type ResolvedOnlineFulfillment = {
  fulfillmentType: OnlineFulfillmentType;
  deliveryArea: string;
  deliveryAddress: string;
  deliveryFee: number;
  zoneId: string | null;
};

const MAX_ZONES = 20;
const MAX_NAME_LEN = 80;
const MAX_ADDRESS_LEN = 300;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function zoneId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Parse + sanitize fulfillment config. Never throws. */
export function parseOnlineFulfillment(settings: Record<string, unknown>): OnlineFulfillmentConfig {
  const raw = asRecord(settings.online_fulfillment);
  const zonesIn = Array.isArray(raw.zones) ? raw.zones : [];
  const zones: OnlineDeliveryZone[] = [];

  for (const entry of zonesIn.slice(0, MAX_ZONES)) {
    const row = asRecord(entry);
    const name = text(row.name).slice(0, MAX_NAME_LEN);
    const feeNum = Number(row.fee);
    if (!name || !Number.isFinite(feeNum) || feeNum < 0) continue;
    const id = text(row.id) || zoneId();
    zones.push({ id: id.slice(0, 40), name, fee: roundMoney(feeNum) });
  }

  const pickupEnabled = raw.pickupEnabled !== false;
  const deliveryEnabled = raw.deliveryEnabled === true;

  return {
    pickupEnabled,
    deliveryEnabled,
    zones,
  };
}

export function defaultOnlineFulfillmentConfig(): OnlineFulfillmentConfig {
  return {
    pickupEnabled: true,
    deliveryEnabled: false,
    zones: [],
  };
}

export function serializeOnlineFulfillment(config: OnlineFulfillmentConfig): Record<string, unknown> {
  return {
    pickupEnabled: config.pickupEnabled === true,
    deliveryEnabled: config.deliveryEnabled === true,
    zones: config.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      fee: roundMoney(zone.fee),
    })),
  };
}

/** Validate settings UI / action input. Throws Arabic errors. */
export function validateOnlineFulfillmentInput(input: unknown): OnlineFulfillmentConfig {
  const raw = asRecord(input);
  const pickupEnabled = raw.pickupEnabled !== false;
  const deliveryEnabled = raw.deliveryEnabled === true;
  const zonesIn = Array.isArray(raw.zones) ? raw.zones : [];

  if (!pickupEnabled && !deliveryEnabled) {
    throw new Error("فعّل الاستلام أو التوصيل على الأقل");
  }
  if (zonesIn.length > MAX_ZONES) {
    throw new Error(`الحد الأقصى لمناطق التوصيل هو ${MAX_ZONES}`);
  }

  const zones: OnlineDeliveryZone[] = [];
  const seenNames = new Set<string>();

  for (const entry of zonesIn) {
    const row = asRecord(entry);
    const name = text(row.name).slice(0, MAX_NAME_LEN);
    const feeNum = Number(row.fee);
    if (!name) throw new Error("اسم منطقة التوصيل مطلوب");
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      throw new Error("رسوم التوصيل يجب أن تكون صفر أو أكثر");
    }
    if (feeNum > 100_000) throw new Error("رسوم التوصيل كبيرة جدًا");
    const key = name.toLowerCase();
    if (seenNames.has(key)) throw new Error(`منطقة مكررة: ${name}`);
    seenNames.add(key);
    zones.push({
      id: text(row.id) || zoneId(),
      name,
      fee: roundMoney(feeNum),
    });
  }

  if (deliveryEnabled && zones.length === 0) {
    throw new Error("أضف منطقة توصيل واحدة على الأقل مع تفعيل التوصيل");
  }

  return { pickupEnabled, deliveryEnabled, zones };
}

/**
 * Resolve fulfillment for a public order. Fee always from zone config — client fee ignored.
 */
export function resolveOnlineFulfillmentFee(
  config: OnlineFulfillmentConfig,
  input: ResolveOnlineFulfillmentInput
): ResolvedOnlineFulfillment {
  const type = input.fulfillmentType;
  if (type !== "pickup" && type !== "delivery") {
    throw new Error("اختر طريقة الاستلام أو التوصيل");
  }

  if (type === "pickup") {
    if (!config.pickupEnabled) {
      throw new Error("الاستلام من الفرع غير متاح حالياً");
    }
    return {
      fulfillmentType: "pickup",
      deliveryArea: "",
      deliveryAddress: "",
      deliveryFee: 0,
      zoneId: null,
    };
  }

  if (!config.deliveryEnabled) {
    throw new Error("التوصيل غير متاح حالياً");
  }
  if (config.zones.length === 0) {
    throw new Error("لا توجد مناطق توصيل مُعدّة");
  }

  const zoneIdRaw = text(input.zoneId);
  const zone = config.zones.find((candidate) => candidate.id === zoneIdRaw);
  if (!zone) {
    throw new Error("اختر منطقة التوصيل");
  }

  const address = text(input.deliveryAddress).slice(0, MAX_ADDRESS_LEN);
  if (address.length < 5) {
    throw new Error("عنوان التوصيل مطلوب (٥ أحرف على الأقل)");
  }

  return {
    fulfillmentType: "delivery",
    deliveryArea: zone.name,
    deliveryAddress: address,
    deliveryFee: roundMoney(zone.fee),
    zoneId: zone.id,
  };
}

export function fulfillmentTypeLabelAr(type: OnlineFulfillmentType | null | undefined): string {
  if (type === "delivery") return "توصيل";
  if (type === "pickup") return "استلام من الفرع";
  return "غير محدد";
}
