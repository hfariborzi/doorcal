import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { SignInButtons } from "@/components/SignInButtons";
import { FullLogo } from "@/components/Logo";
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
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0.22" />
          <stop offset="1" stopColor="#4c1d95" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="wave-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="1" stopColor="#6d28d9" stopOpacity="0.14" />
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
        <div className="flex items-center rounded-full border border-line bg-paper px-5 py-3 text-ink backdrop-blur">
          <FullLogo height="22px" />
        </div>

        <div className="my-auto w-full max-w-2xl py-16 text-center">
          <h1 className="text-5xl font-semibold tracking-[-0.03em] text-ink sm:text-7xl">Simple calendar booking.</h1>
          <p className="mx-auto mt-6 max-w-lg text-xl leading-relaxed text-muted">
            Connect your Google or Microsoft calendar once and share a clean link for people to book time with you.
          </p>
          <div className="mx-auto mt-10 max-w-md">
            {user ? (
              <Link href="/dashboard" className="btn-primary w-full rounded-full py-3 text-base">
                Open your dashboard
              </Link>
            ) : (
              <SignInButtons />
            )}
          </div>
          <p className="mt-5 text-base text-faint">Free and open source.</p>
          <dl className="mx-auto mt-12 grid max-w-xl gap-x-8 gap-y-4 border-t border-line pt-8 text-left text-sm sm:grid-cols-3">
            {[
              ["1. Connect", "Sign in with Google or Microsoft and allow calendar access, once."],
              ["2. Set your hours", "Choose when you take meetings, in person or by video, and get a link."],
              ["3. Get booked", "Invitees pick a free time. The meeting lands on your calendar with the invite sent."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-ink">{t}</dt>
                <dd className="mt-1 leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mx-auto mt-8 max-w-lg border-t border-line pt-6 text-sm leading-relaxed text-faint">
            {APP_NAME} only uses your calendar to see your free/busy times, list your calendars, and view and edit
            events for the meetings booked with you. See the{" "}
            <Link href="/privacy" className="link">privacy policy</Link> and{" "}
            <Link href="/terms" className="link">terms of service</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
