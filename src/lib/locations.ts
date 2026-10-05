import type { BookingLocation, LocationOption } from "@/db/schema";

export const LOCATION_TYPES: { type: LocationOption["type"]; label: string; hint: string }[] = [
  {
    type: "online",
    label: "Video call",
    hint: "A Google Meet or Microsoft Teams link is added automatically, depending on the calendar bookings go to",
  },
  { type: "in_person", label: "In person", hint: "Meet at an address you set" },
  { type: "phone_host_calls", label: "Phone call (you call them)", hint: "Invitee enters their number" },
  { type: "phone_invitee_calls", label: "Phone call (they call you)", hint: "Show your number to the invitee" },
  { type: "custom_link", label: "Custom link (Zoom, Teams…)", hint: "Use a fixed meeting URL" },
];

export function locationLabel(loc: Pick<LocationOption, "type"> & Partial<{ label: string }>): string {
  if (loc.type === "custom_link" && loc.label) return loc.label;
  return LOCATION_TYPES.find((l) => l.type === loc.type)?.label ?? loc.type;
}

/** "Google Meet" or "Microsoft Teams", from the join link itself. */
export function meetingLinkLabel(url: string | null | undefined): string {
  if (!url) return "Video call";
  if (/meet\.google\.com/i.test(url)) return "Google Meet";
  if (/teams\.(microsoft|live)\.com/i.test(url)) return "Microsoft Teams";
  return "Video call";
}

/** Human-readable details of where a booked meeting happens. */
export function bookingLocationText(loc: BookingLocation, meetLink?: string | null): string {
  switch (loc.type) {
    case "online":
      return meetLink ? `${meetingLinkLabel(meetLink)}: ${meetLink}` : "Video call (the host will share the link)";
    case "in_person":
      return loc.value ? `In person: ${loc.value}` : "In person";
    case "phone_host_calls":
      return `Phone call. The host will call ${loc.value ?? "you"}`;
    case "phone_invitee_calls":
      return `Phone call. Call ${loc.value ?? "the host"}`;
    case "custom_link":
      return loc.value ?? "Online";
  }
}
