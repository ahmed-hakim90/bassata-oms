/** Allowed ?src= values for public menu open attribution. */
export const ONLINE_MENU_VIEW_SOURCES = [
  "qr",
  "whatsapp",
  "instagram",
  "facebook",
  "share",
  "link",
  "direct",
  "host",
  "other",
] as const;

export type OnlineMenuViewSource = (typeof ONLINE_MENU_VIEW_SOURCES)[number];

const SOURCE_SET = new Set<string>(ONLINE_MENU_VIEW_SOURCES);

const SOURCE_ALIASES: Record<string, OnlineMenuViewSource> = {
  qr: "qr",
  qrcode: "qr",
  "qr-code": "qr",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  ig: "instagram",
  instagram: "instagram",
  fb: "facebook",
  facebook: "facebook",
  share: "share",
  shared: "share",
  link: "link",
  copy: "link",
  direct: "direct",
  host: "host",
  domain: "host",
  other: "other",
};

export const ONLINE_MENU_VIEW_SOURCE_LABELS_AR: Record<OnlineMenuViewSource, string> = {
  qr: "رمز QR",
  whatsapp: "واتساب",
  instagram: "إنستجرام",
  facebook: "فيسبوك",
  share: "مشاركة",
  link: "رابط",
  direct: "مباشر",
  host: "دومين مخصص",
  other: "أخرى",
};

export function normalizeOnlineMenuViewSource(
  value: string | null | undefined
): OnlineMenuViewSource {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 40);
  if (!raw) return "direct";
  const aliased = SOURCE_ALIASES[raw];
  if (aliased) return aliased;
  if (SOURCE_SET.has(raw)) return raw as OnlineMenuViewSource;
  return "other";
}

/** Crawler / link-preview agents — do not count as menu opens. */
export function isOnlineMenuViewBot(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent ?? "").toLowerCase();
  if (!ua) return false;
  return (
    ua.includes("bot") ||
    ua.includes("crawl") ||
    ua.includes("spider") ||
    ua.includes("slurp") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("facebot") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("discordbot") ||
    ua.includes("telegrambot") ||
    ua.includes("preview") ||
    ua.includes("embedly") ||
    ua.includes("quora link preview") ||
    ua.includes("vkshare") ||
    ua.includes("w3c_validator")
  );
}

export function appendOnlineMenuSourceParam(
  href: string,
  source: OnlineMenuViewSource
): string {
  if (!href) return href;
  const normalized = normalizeOnlineMenuViewSource(source);
  if (href.includes("://")) {
    try {
      const url = new URL(href);
      url.searchParams.set("src", normalized);
      return url.toString();
    } catch {
      // fall through to relative handling
    }
  }
  const join = href.includes("?") ? "&" : "?";
  // Replace existing src if present
  if (/[?&]src=/.test(href)) {
    return href.replace(/([?&]src=)[^&]*/i, `$1${encodeURIComponent(normalized)}`);
  }
  return `${href}${join}src=${encodeURIComponent(normalized)}`;
}
