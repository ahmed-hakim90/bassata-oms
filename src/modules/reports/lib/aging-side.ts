export type AgingSide = "all" | "customers" | "suppliers";

export function parseAgingSide(raw?: string | null): AgingSide {
  if (raw === "customers" || raw === "suppliers") return raw;
  return "all";
}
