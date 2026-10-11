import Link from "next/link";
import { ArrowRight, CalendarCheck2, CalendarClock, Code2, Flag, Layers3, Link2, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, SOURCE_URL } from "@/lib/config";
import { SignInButtons } from "@/components/SignInButtons";
import { FullLogo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero3D } from "@/components/landing/Hero3D";

const STEPS = [
  { n: "1", title: "Connect your calendars.", body: "Google or Microsoft, as many accounts as you have: work, personal, side projects.", tag: "Google and Microsoft", dot: "bg-ink text-canvas shadow-[0_4px_0_#000]" },
  { n: "2", title: "Empty your head.", body: "Type or say everything you need to do, with deadlines. Dori sorts it into tasks.", tag: "Type or talk", dot: "bg-accent text-on-accent shadow-[0_4px_0_#4c1d95]" },
  { n: "3", title: "Get a week that works.", body: "Midore places your tasks in your free time, around every meeting, in deadline order.", tag: "Deadline order", dot: "bg-amber text-[#18181b] shadow-[0_4px_0_#b45309]" },
];

const FEATURES = [
  {
    Icon: Lock,
    tone: "bg-accent-subtle text-accent-soft shadow-[inset_0_-3px_0_rgb(124_58_237/0.25)]",
    title: "Planning that never touches your meetings.",
    body: "Midore plans work into the gaps. Meetings stay where they are, you can pin any block, and Dori's changes can be undone.",
  },
  {
    Icon: Link2,
    tone: "bg-amber-subtle text-amber-ink shadow-[inset_0_-3px_0_rgb(245_158_11/0.35)]",
    title: "Booking built in.",
    body: "Share a link for calls, interviews or office hours. Midore checks every calendar you connect, so nobody double-books you, and adds a Google Meet or Teams link.",
  },
  {
    Icon: Sparkles,
    tone: "bg-vermilion-subtle text-vermilion shadow-[inset_0_-3px_0_rgb(225_29_72/0.25)]",
    title: "Dori, your Midore assistant.",
    body: "Talk or type: “Report due Friday, two contracts to review, run three times a week.” Dori turns it into tasks, plans your day and re-plans when the week falls apart. Optional, and off until you turn it on.",
  },
];

const FOCUS = [
  { Icon: CalendarCheck2, color: "text-amber", title: "A booking link that knows your week", body: "People can only book time you really have free, across every calendar you connect." },
  { Icon: Layers3, color: "text-[#a78bfa]", title: "Focus blocks around your meetings", body: "Work lands in the gaps between meetings, split into sittings you can actually finish." },
  { Icon: Flag, color: "text-[#fb7185]", title: "Every deadline in one plan", body: "Tasks are planned in deadline order, and anything that won't fit is flagged early." },
];

const TRUST = [
  { Icon: ShieldCheck, text: "Calendar access verified by Google." },
  { Icon: Lock, text: "Dori runs on providers that keep no copy of your data and never train on it." },
  { Icon: Code2, text: "The code is public on GitHub.", href: SOURCE_URL },
  { Icon: MapPin, text: "Made in Canada." },
];

const FAQ = [
  ["Will it move my meetings?", "No. Midore never moves or deletes your events. It only places your own planned work, and you can pin any block where you want it."],
  ["Do I have to use the AI?", "No. Booking, tasks and the planner work without it. Dori is off until you turn it on."],
  [
    "What does Midore do with my calendar?",
    "It reads when you're busy so it can plan your work and take bookings, and it adds the events you create or that people book. If you turn on Dori, it sees event titles and times, never who is attending, through providers that keep no copy and never train on it.",
  ],
  ["Is it free?", "Yes. Booking pages, tasks, projects and the planner are free."],
];

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const cta = user ? (
    <Link href="/dashboard" className="btn-primary h-11 px-6">
      Open {APP_NAME} <ArrowRight size={16} />
    </Link>
  ) : (
    <SignInButtons row />
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={`${APP_NAME} home`} className="text-ink">
            <FullLogo height="22px" />
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-medium tracking-[0.06em] text-faint uppercase md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#inside" className="hover:text-ink">What&apos;s inside</a>
            <a href="#faq" className="hover:text-ink">Questions</a>
          </nav>
          {user ? (
            <Link href="/dashboard" className="btn-primary py-1.5">Open {APP_NAME}</Link>
          ) : (
            <Link href="/login" className="btn-secondary py-1.5">Sign in</Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 right-[12%] h-[28rem] w-[28rem] rounded-full bg-amber/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute top-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-accent/15 blur-3xl" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 text-center sm:px-6 sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-faint uppercase shadow-(--shadow-card)">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {APP_NAME} · mee·doh·ray
            </span>
            <h1 className="mt-6 max-w-4xl text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-7xl">
              Your week, planned around what matters.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Tell {APP_NAME} everything on your plate once. It fits your tasks and deadlines into the free time between meetings, and gives
              people a link to book time with you.
            </p>
            <div className="mt-9">{cta}</div>
            <p className="mt-4 text-xs tracking-wide text-faint">Free to start. No card needed.</p>
          </div>
          <div className="relative mx-auto mt-10 max-w-6xl px-2 pb-12 sm:mt-16">
            <Hero3D />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 border-t border-line bg-surface px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-[0.06em] text-accent-soft uppercase">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">Three steps to a calm week.</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="group rounded-lg border border-line bg-canvas p-7 transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-card)">
                  <div className={`grid h-10 w-10 place-items-center rounded-md text-lg font-semibold transition group-hover:-translate-y-0.5 ${s.dot}`}>{s.n}</div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.015em] text-ink">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
                  <p className="mt-8 text-[0.6875rem] font-semibold tracking-[0.06em] text-faint uppercase">{s.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What's inside */}
        <section id="inside" className="scroll-mt-16 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-[0.06em] text-accent-soft uppercase">What&apos;s inside</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">A calendar, a task list and a planner, in one place.</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURES.map(({ Icon, tone, title, body }) => (
                <div key={title} className="rounded-lg border border-line bg-surface p-7 shadow-(--shadow-card) transition duration-300 hover:-translate-y-1">
                  <div className={`grid h-12 w-12 place-items-center rounded-md ${tone}`}>
                    <Icon size={24} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.015em] text-ink">{title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Focus band */}
        <section className="relative overflow-hidden bg-[#141416] px-4 py-20 text-white sm:px-6 sm:py-24">
          <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.06em] text-amber uppercase">
                <CalendarClock size={14} /> For people with full calendars
              </span>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">Protect your focus time.</h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
                Meetings fill the week first. {APP_NAME} puts your focused work into the time that&apos;s left, keeps your booking link honest
                about when you&apos;re free, and shows you early when a deadline won&apos;t fit.
              </p>
            </div>
            <div className="space-y-4">
              {FOCUS.map(({ Icon, color, title, body }) => (
                <div key={title} className="flex items-start gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
                  <Icon size={24} className={`mt-0.5 shrink-0 ${color}`} />
                  <div>
                    <h3 className="text-lg font-medium">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-b border-line bg-surface px-4 py-14 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ Icon, text, href }) => {
              const body = (
                <>
                  <span className="grid h-9 w-9 place-items-center rounded-md border border-line bg-surface text-ink">
                    <Icon size={18} />
                  </span>
                  <p className="font-medium leading-snug text-ink">{text}</p>
                </>
              );
              return href ? (
                <a key={text} href={href} target="_blank" rel="noreferrer" className="flex flex-col gap-3 rounded-lg bg-canvas p-6 transition hover:bg-hover">
                  {body}
                </a>
              ) : (
                <div key={text} className="flex flex-col gap-3 rounded-lg bg-canvas p-6">
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-xs font-semibold tracking-[0.06em] text-accent-soft uppercase">Questions</p>
            <h2 className="mt-2 text-center text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">Good to know</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-lg border border-line bg-surface px-6 py-4 open:shadow-(--shadow-card)">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                    {q}
                    <span className="text-faint transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-line bg-surface px-4 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">Start with one brain dump.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Clear your head, and let {APP_NAME} turn it into a week you can actually do.</p>
          <div className="mt-9 flex justify-center">{cta}</div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
