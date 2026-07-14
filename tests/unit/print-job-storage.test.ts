import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { loadPrintJob, savePrintJob } from "@/lib/print/print-job-storage";

describe("print-job-storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and loads a typed job", () => {
    savePrintJob("test-key", { ok: true, n: 1 });
    const loaded = loadPrintJob(
      "test-key",
      (v): v is { ok: boolean; n: number } =>
        Boolean(v && typeof v === "object" && "ok" in v && "n" in v)
    );
    expect(loaded).toEqual({ ok: true, n: 1 });
  });

  it("returns null for invalid payload", () => {
    savePrintJob("bad", { x: 1 });
    const loaded = loadPrintJob("bad", (v): v is { ok: true } => false);
    expect(loaded).toBeNull();
  });
});
