export type PriceListFormatId = "instagram" | "square" | "story" | "a4";

export type PriceListFormat = {
  id: PriceListFormatId;
  label: string;
  width: number;
  height: number;
  /** Pixel ratio for export (~300 DPI relative to 96 CSS px for A4). */
  pixelRatio: number;
};

export const PRICE_LIST_FORMATS: PriceListFormat[] = [
  {
    id: "instagram",
    label: "Instagram",
    width: 1080,
    height: 1350,
    pixelRatio: 2,
  },
  {
    id: "square",
    label: "Facebook مربع",
    width: 1080,
    height: 1080,
    pixelRatio: 2,
  },
  {
    id: "story",
    label: "Story",
    width: 1080,
    height: 1920,
    pixelRatio: 2,
  },
  {
    id: "a4",
    label: "A4 طباعة",
    width: 794,
    height: 1123,
    pixelRatio: 3,
  },
];

export function getPriceListFormat(id: PriceListFormatId): PriceListFormat {
  return PRICE_LIST_FORMATS.find((f) => f.id === id) ?? PRICE_LIST_FORMATS[0]!;
}

/** Canvas height that fits every selected row (grows past format min height when needed). */
export function computePosterHeight(input: {
  width: number;
  minHeight: number;
  rowCount: number;
  showLogo: boolean;
}): number {
  const rowH = Math.max(72, Math.round(input.width * 0.085));
  const gap = Math.max(10, Math.round(input.width * 0.018));
  const logoBlock = input.showLogo ? Math.round(input.width * 0.22) + 12 : 0;
  const headerH = logoBlock + Math.round(input.width * 0.16) + 56;
  const footerH = Math.max(72, Math.round(input.width * 0.11));
  const mainPadY = 16;
  const rowsH =
    input.rowCount <= 0
      ? 96
      : input.rowCount * rowH + Math.max(0, input.rowCount - 1) * gap;
  return Math.max(input.minHeight, headerH + mainPadY + rowsH + footerH);
}

export const DEFAULT_PRICE_LIST_THEME = {
  background: "#FDEBB2",
  accent: "#4A2C2A",
  card: "#FFF9E6",
  ink: "#4A2C2A",
} as const;

export const PRICE_LIST_PRINT_STORAGE_KEY = "velora-price-list-print";

export type PriceListPrintPayload = {
  listTitle: string;
  sectionTitle: string;
  footerText: string;
  showLogo: boolean;
  showOldPrice: boolean;
  /** Show weight/unit line under product name on the poster. */
  showUnitLine: boolean;
  discountPercent: number;
  background: string;
  accent: string;
  orgName: string;
  orgLogoUrl: string | null;
  currency: string;
  rows: {
    id: string;
    name: string;
    imageUrl: string | null;
    weightLine: string;
    packUnitLabel: string;
    salePrice: number;
    displayPrice: number;
    oldPrice: number | null;
  }[];
};
