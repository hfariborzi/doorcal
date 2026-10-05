import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

const features = [
  { icon: "🔄", title: "Live Google Calendar sync", body: "Checks your real calendars for conflicts so you never get double-booked." },
  { icon: "🎥", title: "Google Meet built in", body: "Online bookings get a Meet link created and sent to everyone automatically." },
  { icon: "📍", title: "In person, phone, or any link", body: "Offer one location or let invitees pick: office, phone, Meet, Zoom, Teams." },
  { icon: "🗓️", title: "Flexible availability", body: "Weekly hours, date overrides, buffers, minimum notice, and daily limits." },
  { icon: "👥", title: "One-on-one and group events", body: "Run office hours or workshops with multiple seats per time slot." },
  { icon: "🔁", title: "Self-serve reschedule & cancel", body: "Invitees manage their own booking. Your calendar updates on its own." },
];

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">◷</span>
          {APP_NAME}
        </div>
        {user ? (
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
        ) : (
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        )}
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Let people book time with you without the back-and-forth emails
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Connect your Google Calendar, set when you&apos;re free, and share one link. Invitees pick a time, and the
          meeting lands on your calendar with a Google Meet link already attached.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={user ? "/dashboard" : "/login"} className="btn-primary px-6 py-3 text-base">
            {user ? "Open dashboard" : "Get started with Google"}
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">Free and open source.</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-6">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
