import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";

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
    <>
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
        <section className="mx-auto max-w-3xl px-6 pb-24">
          <div className="card p-8">
            <h2 className="text-xl font-semibold text-slate-900">How {APP_NAME} uses your Google Calendar</h2>
            <p className="mt-2 text-sm text-slate-600">
              When you sign in, Google asks you to allow three things. {APP_NAME} uses them only for scheduling:
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                <strong className="text-slate-900">See your free/busy times</strong>, so your booking page only offers
                times when you&apos;re actually free.
              </li>
              <li>
                <strong className="text-slate-900">See the list of your calendars</strong>, so you can choose which ones
                count for conflicts and where new bookings go.
              </li>
              <li>
                <strong className="text-slate-900">View and edit events</strong>, to show your calendar in the dashboard
                and to create, update or cancel the meetings people book with you (with a Google Meet link when
                it&apos;s online).
              </li>
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              We never sell your data, use it for ads, or use it to train AI models. You can disconnect or delete your
              account at any time. Read the <Link href="/privacy" className="text-blue-700 underline">privacy policy</Link>{" "}
              for details.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
