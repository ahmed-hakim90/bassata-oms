import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeHostname } from "@/lib/tenancy/custom-domain";

/** Origin for the current request (custom domain or platform fallback). */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = normalizeHostname(h.get("x-forwarded-host") ?? h.get("host"));
  if (host && host !== "localhost") {
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  if (host === "localhost") {
    const port = (h.get("host") ?? "localhost:3000").split(":")[1];
    return `http://localhost${port ? `:${port}` : ":3000"}`;
  }
  return getSiteUrl();
}
