import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSignedCookieValue,
  readSignedCookieValue,
} from "@/lib/auth/signed-cookie";

describe("signed store cookie (ADR-002)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid signed storeId payload", () => {
    vi.stubEnv("SweetFlow_COOKIE_SECRET", "test-cookie-secret-for-unit");
    const value = createSignedCookieValue({ storeId: "store-abc" }, 3600);
    const parsed = readSignedCookieValue<{ storeId?: string }>(value);
    expect(parsed?.storeId).toBe("store-abc");
  });

  it("rejects a plain UUID (unsigned) store cookie", () => {
    vi.stubEnv("SweetFlow_COOKIE_SECRET", "test-cookie-secret-for-unit");
    expect(
      readSignedCookieValue<{ storeId?: string }>(
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      )
    ).toBeNull();
  });

  it("rejects a tampered storeId payload", () => {
    vi.stubEnv("SweetFlow_COOKIE_SECRET", "test-cookie-secret-for-unit");
    const value = createSignedCookieValue({ storeId: "store-abc" }, 3600);
    const [version, payload, signature] = value.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ storeId: "store-evil", exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString("base64url");
    const tampered = `${version}.${tamperedPayload}.${signature}`;
    expect(readSignedCookieValue<{ storeId?: string }>(tampered)).toBeNull();
  });

  it("fails closed in production without SweetFlow_COOKIE_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SweetFlow_COOKIE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-must-not-be-used");
    expect(() => createSignedCookieValue({ storeId: "x" }, 60)).toThrow(
      /SweetFlow_COOKIE_SECRET/
    );
  });
});
