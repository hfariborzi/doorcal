import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { GoogleButton } from "@/components/GoogleButton";
import { LogoMark } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

function Waves() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[30vh] w-full"
      viewBox="0 0 1440 400"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="wave-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4c1d95" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2e1065" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="wave-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0.35" />
          <stop offset="1" stopColor="#4c1d95" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path d="M0 120 C 360 40 720 220 1080 140 S 1440 80 1440 80 V400 H0Z" fill="url(#wave-a)" />
      <path d="M0 250 C 300 180 640 300 980 240 S 1440 200 1440 200 V400 H0Z" fill="url(#wave-b)" />
    </svg>
  );
}

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden">
      <Waves />
      <main className="flex flex-1 flex-col items-center px-6 pt-14 pb-16">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/[0.04] px-4 py-2 font-semibold text-ink backdrop-blur">
          <LogoMark size={26} className="text-accent-soft" />
          {APP_NAME}
        </div>

        <div className="my-auto w-full max-w-xl py-16 text-center">
          <h1 className="text-5xl font-semibold tracking-[-0.03em] text-ink sm:text-6xl">Simple calendar booking.</h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted">
            Connect your Google Calendar once and share a clean link for people to book time with you.
          </p>
          <div className="mx-auto mt-10 max-w-sm">
            {user ? (
              <Link href="/dashboard" className="btn-primary w-full rounded-full py-3 text-[15px]">
                Open your dashboard
              </Link>
            ) : (
              <GoogleButton />
            )}
          </div>
          <p className="mt-4 text-sm text-faint">Free and open source.</p>
          <p className="mx-auto mt-12 max-w-md border-t border-line pt-6 text-xs leading-relaxed text-faint">
            {APP_NAME} only uses your calendar to see your free/busy times, list your calendars, and view and edit
            events for the meetings booked with you. See the{" "}
            <Link href="/privacy" className="link">privacy policy</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
