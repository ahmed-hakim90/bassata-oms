"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

interface BranchQrDownloadCardProps {
  storeName: string;
  storeCode: string;
  address?: string | null;
  phone?: string | null;
  onlineMenuHref: string;
}

const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 1800;

const PALETTES = [
  { start: "#0F766E", end: "#14B8A6", ink: "#0F172A" },
  { start: "#7C3AED", end: "#EC4899", ink: "#111827" },
  { start: "#EA580C", end: "#F59E0B", ink: "#1F2937" },
  { start: "#2563EB", end: "#06B6D4", ink: "#0F172A" },
  { start: "#BE123C", end: "#F97316", ink: "#111827" },
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function paletteFor(value: string) {
  const hash = Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length]!;
}

function buildPosterSvg(input: {
  storeName: string;
  storeCode: string;
  address?: string | null;
  phone?: string | null;
  menuUrl: string;
  qrDataUrl: string;
}): string {
  const palette = paletteFor(input.storeCode || input.storeName);
  const storeName = escapeXml(truncateText(input.storeName, 34));
  const storeCode = escapeXml(input.storeCode || "MENU");
  const address = escapeXml(truncateText(input.address?.trim() || "امسح الكود وشوف المنيو", 58));
  const phone = escapeXml(input.phone?.trim() || "");
  const menuUrl = escapeXml(truncateText(input.menuUrl, 70));
  const initial = escapeXml(input.storeName.trim().slice(0, 1) || "M");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.start}"/>
      <stop offset="100%" stop-color="${palette.end}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="16%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" rx="72" fill="url(#bg)"/>
  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" rx="72" fill="url(#glow)"/>
  <circle cx="1010" cy="210" r="190" fill="#FFFFFF" opacity="0.12"/>
  <circle cx="130" cy="1560" r="240" fill="#FFFFFF" opacity="0.10"/>

  <g direction="rtl" unicode-bidi="plaintext" font-family="Arial, Tahoma, sans-serif">
    <text x="600" y="190" text-anchor="middle" font-size="54" font-weight="800" fill="#FFFFFF">منيو الفرع</text>
    <text x="600" y="262" text-anchor="middle" font-size="104" font-weight="900" fill="#FFFFFF">${storeName}</text>
    <text x="600" y="330" text-anchor="middle" font-size="34" font-weight="700" fill="#FFFFFF" opacity="0.88">${address}</text>

    <g filter="url(#shadow)">
      <rect x="150" y="420" width="900" height="980" rx="62" fill="#FFFFFF"/>
      <rect x="205" y="475" width="790" height="790" rx="48" fill="#F8FAFC"/>
      <image href="${input.qrDataUrl}" x="245" y="515" width="710" height="710"/>
      <circle cx="600" cy="870" r="82" fill="url(#bg)"/>
      <text x="600" y="900" text-anchor="middle" font-size="78" font-weight="900" fill="#FFFFFF">${initial}</text>
      <text x="600" y="1340" text-anchor="middle" font-size="42" font-weight="800" fill="${palette.ink}">امسح الكود وشوف المنيو</text>
    </g>

    <rect x="250" y="1460" width="700" height="92" rx="46" fill="#FFFFFF" opacity="0.18"/>
    <text x="600" y="1522" text-anchor="middle" font-size="34" font-weight="800" fill="#FFFFFF">فرع ${storeCode}</text>
    ${phone ? `<text x="600" y="1598" text-anchor="middle" font-size="32" font-weight="700" fill="#FFFFFF" opacity="0.9">للطلب: ${phone}</text>` : ""}
    <text x="600" y="1662" text-anchor="middle" font-size="24" fill="#FFFFFF" opacity="0.78">${menuUrl}</text>
  </g>
</svg>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function BranchQrDownloadCard({
  storeName,
  storeCode,
  address,
  phone,
  onlineMenuHref,
}: BranchQrDownloadCardProps) {
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [qrDataUrl, setQrDataUrl] = useState("");

  const menuUrl = useMemo(() => {
    if (!origin) return onlineMenuHref;
    return new URL(onlineMenuHref, origin).toString();
  }, [onlineMenuHref, origin]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(menuUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 720,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [menuUrl]);

  const posterSvg = useMemo(() => {
    if (!qrDataUrl) return "";
    return buildPosterSvg({
      storeName,
      storeCode,
      address,
      phone,
      menuUrl,
      qrDataUrl,
    });
  }, [address, menuUrl, phone, qrDataUrl, storeCode, storeName]);

  const posterDataUrl = posterSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(posterSvg)}`
    : "";

  function downloadPng() {
    if (!posterDataUrl) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = POSTER_WIDTH;
      canvas.height = POSTER_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, `${storeCode || storeName}-menu-qr.png`);
      }, "image/png");
    };
    image.src = posterDataUrl;
  }

  function printPoster() {
    if (!posterDataUrl) return;
    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>QR ${escapeXml(storeName)}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; }
      img { width: 100%; max-width: 210mm; height: auto; display: block; }
      @media print { body { background: #fff; } img { width: 210mm; } }
    </style>
  </head>
  <body>
    <img src="${posterDataUrl}" alt="QR ${escapeXml(storeName)}" onload="window.focus(); window.print();" />
  </body>
</html>`);
    printWindow.document.close();
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 sm:grid-cols-[9rem_1fr]">
      <div className="overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
        {posterDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterDataUrl} alt={`QR ${storeName}`} className="aspect-[2/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center text-muted-foreground">
            <QrCode className="size-10" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">QR جاهز للطباعة</p>
          <p className="mt-1 text-xs text-muted-foreground">
            كارت عميل للمنيو العام الخاص بفرع {storeName}.
          </p>
          <p className="mt-2 break-all rounded-lg bg-background/70 px-3 py-2 font-mono text-xs text-muted-foreground">
            {menuUrl}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={menuUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="size-4" />
            فتح
          </Button>
          <Button type="button" size="sm" onClick={downloadPng} disabled={!posterDataUrl}>
            <Download className="size-4" />
            تحميل PNG
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={printPoster} disabled={!posterDataUrl}>
            <Printer className="size-4" />
            طباعة
          </Button>
        </div>
      </div>
    </div>
  );
}
