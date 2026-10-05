import { headers } from "next/headers";
import { appUrl } from "./config";

/** Public base URL: APP_URL if set, otherwise the origin of the current request. Server-only. */
export async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return appUrl(host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : undefined);
}
