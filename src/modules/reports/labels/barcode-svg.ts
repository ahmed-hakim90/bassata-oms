import JsBarcode from "jsbarcode";

export function renderBarcodeSvg(value: string, width = 1.4, height = 40): string {
  if (!value.trim()) return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value.trim(), {
      format: "CODE128",
      width,
      height,
      displayValue: false,
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}
