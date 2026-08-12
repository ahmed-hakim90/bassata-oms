const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_RE = /[A-Za-z]/;

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripEdgePunctuation(value: string): string {
  return value.replace(/^[\s._\-–—]+|[\s._\-–—]+$/g, "").trim();
}

/**
 * Prepare operator-facing text for `next/og` ImageResponse.
 *
 * Satori (inside @vercel/og) crashes on some mixed LTR/RTL strings and on
 * Unicode dashes when shaping Arabic with OpenType features. Keep one dominant
 * script and replace problematic punctuation.
 *
 * Arabic-first product: when both scripts exist, prefer the Arabic span.
 */
export function sanitizeOgText(
  value: string | null | undefined,
  fallback = "منيو أونلاين"
): string {
  const raw = collapseSpaces(
    String(value ?? "").replace(/[\u2013\u2014\u2212]/g, " - ")
  );
  if (!raw) return fallback;

  const hasArabic = ARABIC_RE.test(raw);
  const hasLatin = LATIN_RE.test(raw);

  if (hasArabic && hasLatin) {
    const arabicOnly = stripEdgePunctuation(
      collapseSpaces(
        raw
          .replace(/[A-Za-z0-9]+/g, " ")
          .replace(/[^\u0600-\u06FF\s]/g, " ")
      )
    );
    if (arabicOnly) return arabicOnly.slice(0, 80);

    const latinOnly = stripEdgePunctuation(
      collapseSpaces(
        raw.replace(/[\u0600-\u06FF]+/g, " ").replace(/[^\w\s.-]/g, " ")
      )
    );
    return (latinOnly || fallback).slice(0, 80);
  }

  if (hasArabic) {
    return (
      stripEdgePunctuation(
        collapseSpaces(raw.replace(/[^\u0600-\u06FF0-9\s.-]/g, " "))
      ).slice(0, 80) || fallback
    );
  }

  return (
    stripEdgePunctuation(
      collapseSpaces(raw.replace(/[^\w\s.-]/g, " "))
    ).slice(0, 80) || fallback
  );
}

/**
 * Satori still lays out Arabic words left-to-right. Reverse word order so the
 * visual reading order matches Arabic.
 */
export function orderOgTextForSatori(value: string): string {
  const text = collapseSpaces(value);
  if (!text || !ARABIC_RE.test(text) || LATIN_RE.test(text)) return text;
  return text.split(" ").reverse().join(" ");
}
