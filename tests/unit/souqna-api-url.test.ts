import { describe, expect, it } from "vitest";
import {
  buildSouqnaApiEndpoints,
  isValidApiBaseUrl,
  normalizeApiBaseUrl,
} from "@/lib/souqna-api-url";

describe("normalizeApiBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeApiBaseUrl("https://pos.example.com/")).toBe("https://pos.example.com");
  });
});

describe("buildSouqnaApiEndpoints", () => {
  it("builds product and order urls", () => {
    expect(buildSouqnaApiEndpoints("https://pos.example.com")).toEqual({
      api_base_url: "https://pos.example.com",
      products_url: "https://pos.example.com/api/souqna/products",
      orders_url: "https://pos.example.com/api/souqna/orders",
    });
  });
});

describe("isValidApiBaseUrl", () => {
  it("accepts http(s) only", () => {
    expect(isValidApiBaseUrl("https://pos.example.com")).toBe(true);
    expect(isValidApiBaseUrl("ftp://x")).toBe(false);
    expect(isValidApiBaseUrl("")).toBe(false);
  });
});
