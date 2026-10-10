import { NextResponse, type NextRequest } from "next/server";
import { noteCalendarChange } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";

/**
 * Microsoft Graph change notifications. When a subscription is created, Graph first sends a validationToken
 * that must be echoed back as plain text within ten seconds. After that, each notification lists the
 * subscription id and our clientState, which is checked before anything is marked.
 */
export async function POST(req: NextRequest) {
  const validationToken = req.nextUrl.searchParams.get("validationToken");
  if (validationToken) return new NextResponse(validationToken.slice(0, 1000), { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
  try {
    const body = (await req.json()) as { value?: { subscriptionId?: string; clientState?: string }[] };
    for (const n of (body.value ?? []).slice(0, 100)) {
      if (n.subscriptionId) await noteCalendarChange(n.subscriptionId, n.clientState ?? null);
    }
  } catch (err) {
    logError("microsoft webhook", err);
  }
  return new NextResponse(null, { status: 202 });
}
