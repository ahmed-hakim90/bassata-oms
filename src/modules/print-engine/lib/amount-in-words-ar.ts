const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function underThousand(n: number): string {
  if (n <= 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ones = n % 10;
    const tens = Math.floor(n / 10);
    return ones ? `${ONES[ones]} و${TENS[tens]}` : TENS[tens];
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return rest ? `${HUNDREDS[hundreds]} و${underThousand(rest)}` : HUNDREDS[hundreds];
}

function chunkName(scale: number, value: number): string {
  if (scale === 1) {
    if (value === 1) return "ألف";
    if (value === 2) return "ألفان";
    if (value >= 3 && value <= 10) return "آلاف";
    return "ألف";
  }
  if (scale === 2) {
    if (value === 1) return "مليون";
    if (value === 2) return "مليونان";
    if (value >= 3 && value <= 10) return "ملايين";
    return "مليون";
  }
  return "مليار";
}

/** Arabic tafqeet for positive money amounts (integer + 2 decimal piastres). */
export function amountInArabicWords(amount: number, currencyLabel = "جنيه"): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const rounded = Math.round(amount * 100) / 100;
  const pounds = Math.floor(rounded);
  const piastres = Math.round((rounded - pounds) * 100);
  const parts: string[] = [];

  if (pounds === 0) {
    parts.push("صفر");
  } else {
    const billions = Math.floor(pounds / 1_000_000_000);
    const millions = Math.floor((pounds % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((pounds % 1_000_000) / 1000);
    const rest = pounds % 1000;
    const named: string[] = [];
    if (billions) named.push(`${underThousand(billions)} ${chunkName(3, billions)}`);
    if (millions) named.push(`${underThousand(millions)} ${chunkName(2, millions)}`);
    if (thousands) {
      named.push(
        thousands === 1 ? "ألف" : thousands === 2 ? "ألفان" : `${underThousand(thousands)} ${chunkName(1, thousands)}`
      );
    }
    if (rest) named.push(underThousand(rest));
    parts.push(named.join(" و"));
  }

  let text = `${parts.join(" ")} ${currencyLabel} فقط`;
  if (piastres > 0) {
    text += ` و${underThousand(piastres)} قرش`;
  }
  return `${text} لا غير`;
}
