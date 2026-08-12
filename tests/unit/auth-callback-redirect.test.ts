import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "@/app/auth/callback/route";

describe("resolveAuthRedirect", () => {
  const origin = "https://velora.example";

  it.each([
    [null, "/"],
    ["", "/"],
    ["https://evil.example/steal", "/"],
    ["//evil.example/steal", "/"],
    ["javascript:alert(1)", "/"],
    ["/pos?store=1", "/pos?store=1"],
  ])("maps %s to a safe destination", (requested, expected) => {
    const destination = resolveAuthRedirect(origin, requested);
    expect(destination.origin).toBe(origin);
    expect(`${destination.pathname}${destination.search}`).toBe(expected);
  });
});
