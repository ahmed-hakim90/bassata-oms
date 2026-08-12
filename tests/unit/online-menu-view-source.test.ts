import { describe, expect, it } from "vitest";
import {
  appendOnlineMenuSourceParam,
  isOnlineMenuViewBot,
  normalizeOnlineMenuViewSource,
} from "@/modules/online-menu/lib/online-menu-view-source";

describe("normalizeOnlineMenuViewSource", () => {
  it("defaults empty to direct", () => {
    expect(normalizeOnlineMenuViewSource(null)).toBe("direct");
    expect(normalizeOnlineMenuViewSource("")).toBe("direct");
  });

  it("maps aliases", () => {
    expect(normalizeOnlineMenuViewSource("wa")).toBe("whatsapp");
    expect(normalizeOnlineMenuViewSource("QR")).toBe("qr");
    expect(normalizeOnlineMenuViewSource("ig")).toBe("instagram");
    expect(normalizeOnlineMenuViewSource("utm-unknown")).toBe("other");
  });
});

describe("appendOnlineMenuSourceParam", () => {
  it("adds src to relative paths", () => {
    expect(appendOnlineMenuSourceParam("/menu/cafe", "qr")).toBe("/menu/cafe?src=qr");
    expect(appendOnlineMenuSourceParam("/menu/cafe?token=abc", "qr")).toBe(
      "/menu/cafe?token=abc&src=qr"
    );
  });

  it("replaces existing src", () => {
    expect(appendOnlineMenuSourceParam("/menu/cafe?src=link", "qr")).toBe(
      "/menu/cafe?src=qr"
    );
  });
});

describe("isOnlineMenuViewBot", () => {
  it("detects common crawlers", () => {
    expect(isOnlineMenuViewBot("facebookexternalhit/1.1")).toBe(true);
    expect(isOnlineMenuViewBot("Twitterbot/1.0")).toBe(true);
    expect(isOnlineMenuViewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(false);
  });
});
