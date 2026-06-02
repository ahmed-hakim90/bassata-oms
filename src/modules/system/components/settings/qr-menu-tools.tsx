"use client";

import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Store } from "@/lib/types";

export function QrMenuTools({
  store,
  origin,
  menuSlug,
}: {
  store: Store;
  origin: string;
  menuSlug: string;
}) {
  const path = `/menu/${menuSlug}`;
  const url = origin ? `${origin}${path}` : path;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  return (
    <div className="grid gap-2 rounded-lg bg-muted/40 p-3">
      {origin ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrUrl}
          alt={`${store.name} online menu QR`}
          className="size-28 rounded-md bg-white p-2"
        />
      ) : null}
      <Input value={url} readOnly className="text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(url)}
        >
          <Copy className="size-4" />
          Copy
        </Button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLink className="size-4" />
          Open
        </a>
        {origin ? (
          <a
            href={qrUrl}
            download={`${store.name}-menu-qr.png`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <QrCode className="size-4" />
            QR
          </a>
        ) : null}
      </div>
    </div>
  );
}
