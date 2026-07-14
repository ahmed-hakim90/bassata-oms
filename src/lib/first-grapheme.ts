/** First visible grapheme — never use string.slice(0,1) on emoji (breaks UTF-16 pairs). */
export function firstGrapheme(value: string, fallback = "?"): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = segmenter.segment(trimmed)[Symbol.iterator]().next().value;
    if (first?.segment) return first.segment;
  }
  return Array.from(trimmed)[0] ?? fallback;
}
