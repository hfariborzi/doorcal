"use client";

import { useSyncExternalStore } from "react";
import type { Provider } from "@/db/schema";

const noopSubscribe = () => () => {};
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const DEFAULT_LABEL: Record<Provider, string> = { google: "Continue with Google", microsoft: "Continue with Microsoft" };

// Google's sign-in button guidelines (light): white, 1px #747775 border, #1F1F1F text, medium weight, 40px
// tall, Roboto. Microsoft's: white, #8C8C8C border, #5E5E5E text, semibold. Both stay light in dark mode.
const BRAND: Record<Provider, { border: string; color: string; weight: number; font: string }> = {
  google: { border: "#747775", color: "#1F1F1F", weight: 500, font: '"Roboto", "Helvetica Neue", Arial, sans-serif' },
  microsoft: { border: "#8C8C8C", color: "#5E5E5E", weight: 600, font: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' },
};
// The dark variants both providers publish: Google #131314 fill, #8E918F border, #E3E3E3 text; Microsoft #2F2F2F
// fill with white text. Used where the sign-in is the page's primary action.
const DARK: Record<Provider, { bg: string; border: string; color: string }> = {
  google: { bg: "#131314", border: "#8E918F", color: "#E3E3E3" },
  microsoft: { bg: "#2F2F2F", border: "#2F2F2F", color: "#FFFFFF" },
};

/**
 * Starts the provider's OAuth flow. `connect` links the account to the signed-in user instead of signing in;
 * `reconnect` re-authorises an existing account. The light button follows both providers' branding rules.
 */
export function ProviderButton({
  provider,
  label,
  connect = false,
  reconnect,
  compact = false,
  inline = false,
  dark = false,
}: {
  provider: Provider;
  label?: string;
  connect?: boolean;
  reconnect?: number;
  compact?: boolean;
  inline?: boolean; // sized to its label instead of the full width
  dark?: boolean; // the providers' dark button, 48px tall, for a primary action
}) {
  const tz = useSyncExternalStore(noopSubscribe, browserTz, () => "");
  const q = new URLSearchParams();
  if (tz) q.set("tz", tz);
  if (reconnect) q.set("reconnect", String(reconnect));
  else if (connect) q.set("connect", "1");
  return (
    <a
      href={`/api/auth/${provider}?${q}`}
      className={`btn border ${dark ? "hover:brightness-125" : "bg-white hover:bg-[#f2f2f2]"} ${compact ? "rounded-md px-3 py-1.5 text-sm" : `${inline ? "w-full sm:w-auto" : "w-full"} rounded-md px-6`}`}
      style={{
        borderColor: dark ? DARK[provider].border : BRAND[provider].border,
        color: dark ? DARK[provider].color : BRAND[provider].color,
        background: dark ? DARK[provider].bg : undefined,
        fontWeight: BRAND[provider].weight,
        fontFamily: BRAND[provider].font,
        ...(compact ? {} : { height: dark ? 48 : 44, fontSize: dark ? 15 : 14 }),
      }}
    >
      {provider === "google" ? <GoogleLogo /> : <MicrosoftLogo />}
      {label ?? DEFAULT_LABEL[provider]}
    </a>
  );
}
