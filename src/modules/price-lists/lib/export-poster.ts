import { toBlob, toJpeg, toPng } from "html-to-image";
import type { PriceListFormat } from "./formats";

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function resolveExportSize(node: HTMLElement, format: PriceListFormat) {
  const found = node.matches("[data-price-list-poster]")
    ? node
    : node.querySelector<HTMLElement>("[data-price-list-poster]");
  const poster = found ?? node;
  const width = Math.max(
    format.width,
    Math.round(poster.scrollWidth || poster.offsetWidth || format.width)
  );
  const height = Math.max(
    format.height,
    Math.round(poster.scrollHeight || poster.offsetHeight || format.height)
  );
  return { poster, width, height };
}

function exportOptions(node: HTMLElement, format: PriceListFormat) {
  const { width, height } = resolveExportSize(node, format);
  return {
    cacheBust: true,
    pixelRatio: format.pixelRatio,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
    },
  };
}

export async function exportPosterPng(
  node: HTMLElement,
  format: PriceListFormat
): Promise<string> {
  await waitForImages(node);
  const { poster } = resolveExportSize(node, format);
  return toPng(poster, exportOptions(poster, format));
}

export async function exportPosterJpeg(
  node: HTMLElement,
  format: PriceListFormat
): Promise<string> {
  await waitForImages(node);
  const { poster } = resolveExportSize(node, format);
  return toJpeg(poster, { ...exportOptions(poster, format), quality: 0.95 });
}

export async function exportPosterBlob(
  node: HTMLElement,
  format: PriceListFormat,
  type: "image/png" | "image/jpeg" = "image/png"
): Promise<Blob | null> {
  await waitForImages(node);
  const { poster } = resolveExportSize(node, format);
  return toBlob(poster, {
    ...exportOptions(poster, format),
    type,
    quality: type === "image/jpeg" ? 0.95 : undefined,
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function shareTextUrls(text: string) {
  const encoded = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${encoded}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent("")}&text=${encoded}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
  };
}
