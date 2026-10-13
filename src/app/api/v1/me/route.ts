import { aiConfigured } from "@/lib/ai";
import { json, withDevice } from "@/lib/api-v1";
import { appUrl } from "@/lib/config";

/** Who is signed in, their booking link, and whether Dori is on. */
export async function GET(req: Request) {
  return withDevice(req, "me", async (user) =>
    json({
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      bookingUrl: `${appUrl()}/${user.username}`,
      dori: { enabled: !!user.doriConsentAt && aiConfigured(), character: user.doriPrefs?.character ?? "puppy" },
    }),
  );
}
