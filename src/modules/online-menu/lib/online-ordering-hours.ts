/**
 * Online ordering hours stored in `stores.settings` (JSON only — no new tables).
 *
 * Shape:
 *   online_ordering_paused: boolean
 *   online_ordering_hours: {
 *     enforce: boolean
 *     timezone?: string          // IANA; fallback store.timezone → Africa/Cairo
 *     days: {
 *       sun|mon|…|sat?: { closed: true } | { windows: [{ open: "HH:mm", close: "HH:mm" }] }
 *     }
 *   }
 *
 * Backward compatible: missing / enforce:false → hours not gated (ordering_enabled still applies).
 */

export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS_AR: Record<WeekdayKey, string> = {
  sun: "الأحد",
  mon: "الإثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
  sat: "السبت",
};

export type TimeWindow = { open: string; close: string };

export type DayHours =
  | { closed: true; windows?: never }
  | { closed?: false; windows: TimeWindow[] };

export type OnlineOrderingHoursConfig = {
  enforce: boolean;
  timezone?: string;
  days: Partial<Record<WeekdayKey, DayHours>>;
};

export type OnlineOrderingAvailability = {
  canOrder: boolean;
  orderingEnabled: boolean;
  paused: boolean;
  enforceHours: boolean;
  isWithinHours: boolean;
  timezone: string;
  weekday: WeekdayKey;
  reason:
    | "open"
    | "ordering_disabled"
    | "paused"
    | "outside_hours"
    | "day_closed";
  messageAr: string;
  todayWindowsLabel: string | null;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_TZ = "Africa/Cairo";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isValidTimeHm(value: string): boolean {
  return TIME_RE.test(value);
}

export function parseTimeToMinutes(value: string): number | null {
  if (!TIME_RE.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function weekdayKeyFromJsDay(jsDay: number): WeekdayKey {
  return WEEKDAY_KEYS[((jsDay % 7) + 7) % 7]!;
}

/** Parse + sanitize hours config from settings. Invalid fragments dropped; never throws. */
export function parseOnlineOrderingHours(settings: Record<string, unknown>): OnlineOrderingHoursConfig {
  const raw = asRecord(settings.online_ordering_hours);
  const enforce = raw.enforce === true;
  const timezone =
    typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : undefined;

  const daysRaw = asRecord(raw.days);
  const days: Partial<Record<WeekdayKey, DayHours>> = {};

  for (const key of WEEKDAY_KEYS) {
    const day = asRecord(daysRaw[key]);
    if (Object.keys(day).length === 0) continue;
    if (day.closed === true) {
      days[key] = { closed: true };
      continue;
    }
    const windowsIn = Array.isArray(day.windows) ? day.windows : [];
    const windows: TimeWindow[] = [];
    for (const entry of windowsIn) {
      const row = asRecord(entry);
      const open = typeof row.open === "string" ? row.open.trim() : "";
      const close = typeof row.close === "string" ? row.close.trim() : "";
      if (!isValidTimeHm(open) || !isValidTimeHm(close)) continue;
      windows.push({ open, close });
    }
    if (windows.length > 0) {
      days[key] = { windows };
    }
  }

  return { enforce, timezone, days };
}

/**
 * Validates a candidate hours object for persistence.
 * Throws Arabic Error on invalid input.
 */
export function validateOnlineOrderingHoursInput(
  input: unknown
): OnlineOrderingHoursConfig {
  const raw = asRecord(input);
  const enforce = raw.enforce === true;
  let timezone: string | undefined;
  if (raw.timezone !== undefined && raw.timezone !== null && raw.timezone !== "") {
    if (typeof raw.timezone !== "string" || !raw.timezone.trim()) {
      throw new Error("المنطقة الزمنية لساعات الطلب غير صالحة");
    }
    timezone = raw.timezone.trim();
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new Error("المنطقة الزمنية لساعات الطلب غير معروفة");
    }
  }

  const daysRaw = asRecord(raw.days);
  const days: Partial<Record<WeekdayKey, DayHours>> = {};

  for (const key of Object.keys(daysRaw)) {
    if (!(WEEKDAY_KEYS as readonly string[]).includes(key)) {
      throw new Error("يوم غير صالح في جدول الساعات");
    }
  }

  for (const key of WEEKDAY_KEYS) {
    if (!(key in daysRaw)) continue;
    const day = asRecord(daysRaw[key]);
    if (day.closed === true) {
      days[key] = { closed: true };
      continue;
    }
    if (!Array.isArray(day.windows) || day.windows.length === 0) {
      throw new Error(`حدد ساعات أو أغلق يوم ${WEEKDAY_LABELS_AR[key]}`);
    }
    if (day.windows.length > 3) {
      throw new Error(`الحد الأقصى 3 فترات ليوم ${WEEKDAY_LABELS_AR[key]}`);
    }
    const windows: TimeWindow[] = [];
    for (const entry of day.windows) {
      const row = asRecord(entry);
      const open = typeof row.open === "string" ? row.open.trim() : "";
      const close = typeof row.close === "string" ? row.close.trim() : "";
      if (!isValidTimeHm(open) || !isValidTimeHm(close)) {
        throw new Error(`وقت غير صالح في يوم ${WEEKDAY_LABELS_AR[key]} (صيغة HH:mm)`);
      }
      if (open === close) {
        throw new Error(`فترة الصفر غير مسموحة في يوم ${WEEKDAY_LABELS_AR[key]}`);
      }
      windows.push({ open, close });
    }
    days[key] = { windows };
  }

  if (enforce && Object.keys(days).length === 0) {
    throw new Error("فعّل الساعات بعد تحديد جدول أيام واحد على الأقل");
  }

  return { enforce, timezone, days };
}

export function isWithinTimeWindows(minutesOfDay: number, windows: TimeWindow[]): boolean {
  for (const window of windows) {
    const open = parseTimeToMinutes(window.open);
    const close = parseTimeToMinutes(window.close);
    if (open == null || close == null) continue;
    if (open === close) continue;
    if (open < close) {
      if (minutesOfDay >= open && minutesOfDay < close) return true;
    } else {
      // Overnight window e.g. 22:00 → 02:00
      if (minutesOfDay >= open || minutesOfDay < close) return true;
    }
  }
  return false;
}

function formatWindowsLabel(windows: TimeWindow[]): string {
  return windows.map((w) => `${w.open}–${w.close}`).join(" · ");
}

/** Customer-facing Arabic for today's windows (e.g. من 10:00 إلى 23:00). */
function formatWindowsLabelAr(windows: TimeWindow[]): string {
  return windows.map((w) => `من ${w.open} إلى ${w.close}`).join(" · ");
}

function zonedParts(now: Date, timeZone: string): { weekday: WeekdayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const map: Record<string, WeekdayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  const weekday = map[weekdayRaw] ?? "sun";
  return { weekday, minutes: hour * 60 + minute };
}

export function resolveOrderingTimezone(
  settings: Record<string, unknown>,
  storeTimezone?: string | null
): string {
  const hours = parseOnlineOrderingHours(settings);
  if (hours.timezone) return hours.timezone;
  if (storeTimezone?.trim()) return storeTimezone.trim();
  return DEFAULT_TZ;
}

export function evaluateOnlineOrderingAvailability(input: {
  settings: Record<string, unknown>;
  storeTimezone?: string | null;
  now?: Date;
}): OnlineOrderingAvailability {
  const { settings } = input;
  const orderingEnabled = settings.online_menu_ordering_enabled === true;
  const paused = settings.online_ordering_paused === true;
  const hours = parseOnlineOrderingHours(settings);
  const timezone = resolveOrderingTimezone(settings, input.storeTimezone);
  const now = input.now ?? new Date();

  let weekday: WeekdayKey = "sun";
  let minutes = 0;
  try {
    const zoned = zonedParts(now, timezone);
    weekday = zoned.weekday;
    minutes = zoned.minutes;
  } catch {
    // Invalid tz at runtime — fall back to Cairo parts via UTC offset best-effort.
    const zoned = zonedParts(now, DEFAULT_TZ);
    weekday = zoned.weekday;
    minutes = zoned.minutes;
  }

  const day = hours.days[weekday];
  let todayWindowsLabel: string | null = null;
  let isWithinHours = true;
  let dayClosed = false;

  if (hours.enforce) {
    if (!day || day.closed === true) {
      isWithinHours = false;
      dayClosed = true;
    } else {
      todayWindowsLabel = formatWindowsLabel(day.windows);
      isWithinHours = isWithinTimeWindows(minutes, day.windows);
    }
  } else if (day && day.closed !== true && day.windows?.length) {
    todayWindowsLabel = formatWindowsLabel(day.windows);
  }

  if (!orderingEnabled) {
    return {
      canOrder: false,
      orderingEnabled,
      paused,
      enforceHours: hours.enforce,
      isWithinHours,
      timezone,
      weekday,
      reason: "ordering_disabled",
      messageAr: "الطلب من المنيو غير مفعّل حالياً — يمكنك تصفح الأصناف فقط.",
      todayWindowsLabel,
    };
  }

  if (paused) {
    return {
      canOrder: false,
      orderingEnabled,
      paused,
      enforceHours: hours.enforce,
      isWithinHours,
      timezone,
      weekday,
      reason: "paused",
      messageAr: "استقبال الطلبات متوقف مؤقتاً. جرّب لاحقاً أو اتصل بالفرع.",
      todayWindowsLabel,
    };
  }

  if (hours.enforce && dayClosed) {
    return {
      canOrder: false,
      orderingEnabled,
      paused,
      enforceHours: hours.enforce,
      isWithinHours: false,
      timezone,
      weekday,
      reason: "day_closed",
      messageAr: `الفرع مغلق اليوم (${WEEKDAY_LABELS_AR[weekday]}). يمكنك تصفح المنيو فقط.`,
      todayWindowsLabel,
    };
  }

  if (hours.enforce && !isWithinHours) {
    const windowsAr =
      day && day.closed !== true && day.windows?.length
        ? formatWindowsLabelAr(day.windows)
        : null;
    return {
      canOrder: false,
      orderingEnabled,
      paused,
      enforceHours: hours.enforce,
      isWithinHours: false,
      timezone,
      weekday,
      reason: "outside_hours",
      messageAr: windowsAr
        ? `خارج مواعيد الطلب حالياً. يمكنك الطلب اليوم ${windowsAr}.`
        : "خارج مواعيد الطلب حالياً.",
      todayWindowsLabel,
    };
  }

  return {
    canOrder: true,
    orderingEnabled,
    paused,
    enforceHours: hours.enforce,
    isWithinHours: true,
    timezone,
    weekday,
    reason: "open",
    messageAr: todayWindowsLabel
      ? `الطلبات متاحة الآن · مواعيد اليوم: ${todayWindowsLabel}`
      : "الطلبات متاحة الآن.",
    todayWindowsLabel,
  };
}

/** Persistable defaults for branch settings UI. */
export function defaultOnlineOrderingHoursConfig(): OnlineOrderingHoursConfig {
  return {
    enforce: false,
    days: {
      sun: { windows: [{ open: "10:00", close: "23:00" }] },
      mon: { windows: [{ open: "10:00", close: "23:00" }] },
      tue: { windows: [{ open: "10:00", close: "23:00" }] },
      wed: { windows: [{ open: "10:00", close: "23:00" }] },
      thu: { windows: [{ open: "10:00", close: "23:00" }] },
      fri: { windows: [{ open: "10:00", close: "23:00" }] },
      sat: { windows: [{ open: "10:00", close: "23:00" }] },
    },
  };
}

export function serializeOnlineOrderingHours(
  config: OnlineOrderingHoursConfig
): Record<string, unknown> {
  const days: Record<string, unknown> = {};
  for (const key of WEEKDAY_KEYS) {
    const day = config.days[key];
    if (!day) continue;
    if (day.closed === true) {
      days[key] = { closed: true };
    } else {
      days[key] = { windows: day.windows.map((w) => ({ open: w.open, close: w.close })) };
    }
  }
  return {
    enforce: config.enforce === true,
    ...(config.timezone ? { timezone: config.timezone } : {}),
    days,
  };
}
