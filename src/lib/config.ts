export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "DoorCal";

export function appUrl(fallbackOrigin?: string): string {
  const url = process.env.APP_URL || fallbackOrigin || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

// Paths that can never be used as a username because they collide with app routes.
export const RESERVED_USERNAMES = new Set([
  "api", "app", "admin", "dashboard", "login", "logout", "signup", "settings", "booking",
  "bookings", "about", "help", "privacy", "terms", "static", "_next", "favicon.ico",
  "robots.txt", "sitemap.xml", "auth", "calendar", "event-types", "availability", "www",
]);

/** Shown in the footer, privacy policy and terms. Set CONTACT_EMAIL for a public instance. */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "";

export const SOURCE_URL = "https://github.com/hfariborzi/doorcal";
