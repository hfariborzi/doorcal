import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Code2,
  Flag,
  Layers3,
  Link2,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, SOURCE_URL } from "@/lib/config";
import { SignInButtons } from "@/components/SignInButtons";
import { FullLogo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero3D } from "@/components/landing/Hero3D";

const STEPS = [
  {
    n: "01",
    title: "Connect every calendar.",
    body: "Bring Google and Microsoft calendars together—work, personal, and everything in between.",
    note: "One view, no double-booking",
    color: "bg-ink text-canvas",
  },
  {
    n: "02",
    title: "Empty your head.",
    body: "Type or say what needs doing, how long it takes, and when it is due. Dori turns it into a clear task list.",
    note: "Type it or say it",
    color: "bg-accent text-white",
  },
  {
    n: "03",
    title: "See a week that fits.",
    body: "Midore places focused work into the open spaces around your meetings, in deadline order.",
    note: "Planned around real life",
    color: "bg-[#7c3aed] text-white",
  },
];

const FEATURES = [
  {
    Icon: Lock,
    label: "PROTECTED TIME",
    tone: "bg-accent-subtle text-accent-soft",
    title: "Planning that leaves meetings exactly where they are.",
    body: "Midore works with the gaps in your calendar. Pin a block when it must stay put, and undo Dori’s changes whenever you need to.",
    detail: "Meetings stay fixed",
  },
  {
    Icon: Link2,
    label: "SMART BOOKING",
    tone: "bg-[#ede9fe] text-[#5b21b6] dark:bg-[#7c3aed]/15 dark:text-[#d2bbff]",
    title: "A booking link that knows your actual week.",
    body: "Share one link for calls, interviews, or office hours. Availability is checked across every connected calendar before a time is offered.",
    detail: "Google Meet + Teams",
  },
  {
    Icon: Sparkles,
    label: "DORI ASSISTANT",
    tone: "bg-vermilion-subtle text-vermilion",
    title: "Turn a messy brain dump into a workable plan.",
    body: "Tell Dori what is due, what can move, and what you want to make time for. She creates the tasks, proposes a plan, and helps re-plan when the week changes.",
    detail: "Optional and off by default",
  },
];

const FOCUS = [
  { Icon: CalendarCheck2, color: "text-amber", title: "Booking follows your real availability", body: "People only see times that are free across every calendar you connect." },
  { Icon: Layers3, color: "text-[#c4b5fd]", title: "Focused work lands in usable blocks", body: "Long tasks can be split into sittings that fit between the meetings already on your week." },
  { Icon: Flag, color: "text-[#fb7185]", title: "Deadlines become visible early", body: "If the work will not fit, Midore flags the problem while there is still time to change the plan." },
];

const TRUST = [
  { Icon: ShieldCheck, text: "Calendar access verified by Google." },
  { Icon: Lock, text: "AI providers keep no copy of your data and never train on it." },
  { Icon: Code2, text: "Open-source and inspectable on GitHub.", href: SOURCE_URL },
  { Icon: MapPin, text: "Thoughtfully made in Canada." },
];

const FAQ = [
  ["Will it move my meetings?", "No. Midore never moves or deletes your meetings. It only places your own planned work, and you can pin any block you want to keep in place."],
  ["Do I have to use the AI?", "No. Booking, tasks, and the planner work without it. Dori is optional and stays off until you turn it on."],
  [
    "What does Midore do with my calendar?",
    "It reads when you are busy so it can plan work and take bookings, and it adds events that you create or that people book. If you enable Dori, she sees event titles and times—but never attendee details—through providers that keep no copy and never train on the data.",
  ],
  ["Is it free?", "Yes. Booking pages, tasks, projects, and the planner are free."],
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
    <div className="landing-primary landing-ambient flex min-h-screen flex-1 flex-col overflow-hidden">
      {/* No navigation bar: just the logo and the one action, sitting on the page. */}
      <header className="relative z-40">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} home`} className="text-ink">
            <FullLogo height="23px" markClassName="text-accent" />
          </Link>
          {user ? (
            <Link href="/dashboard" className="btn-primary h-9 px-4">Open {APP_NAME}</Link>
          ) : (
            <Link href="/login" className="btn-primary h-9 px-4">Start free <ArrowRight size={14} /></Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <section className="relative">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[44rem] opacity-35 [background-image:linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,#000,transparent)]" />

          <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8">
            <div className="inline-flex items-center gap-2 border border-line bg-surface/90 px-3 py-1.5 text-[0.68rem] font-semibold tracking-[0.08em] text-faint uppercase shadow-(--shadow-card)">
              <span className="h-2 w-2 bg-accent" /> {APP_NAME} · mee-doh-ray
            </div>
            <h1 className="mt-7 max-w-4xl text-[2.8rem] leading-[1.02] font-semibold tracking-[-0.05em] text-ink text-balance sm:text-6xl lg:text-[4.6rem]">
              Your week, <span className="relative text-accent">planned<span aria-hidden className="absolute right-0 -bottom-1 left-0 h-1 bg-accent/20" /></span> around what matters.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Tell {APP_NAME} what is on your plate once. It fits tasks and deadlines into the free time between meetings, and gives people a booking link that knows when you are truly free.
            </p>
            <div className="mt-9">{cta}</div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-faint">
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-accent" /> Free to start</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-accent" /> No card needed</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-accent" /> AI is optional</span>
            </div>
          </div>

          <div className="relative mx-auto mt-4 max-w-7xl px-1 pb-10 sm:mt-8 sm:px-6 sm:pb-16 lg:px-8">
            <Hero3D />
          </div>
        </section>

        <section id="how" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 border-b border-line pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-[0.7rem] font-bold tracking-[0.09em] text-accent-soft uppercase">How it works</p>
                <h2 className="mt-3 max-w-xl text-4xl leading-tight font-semibold tracking-[-0.04em] text-ink sm:text-5xl">From full head to clear week.</h2>
              </div>
              <p className="max-w-2xl text-lg leading-relaxed text-muted lg:justify-self-end">
                Midore works from the calendar you already have. Give it the loose ends, and it turns the remaining time into a realistic plan.
              </p>
            </div>

            <div className="grid border-x border-b border-line md:grid-cols-3">
              {STEPS.map((step, index) => (
                <article key={step.n} className={`group relative min-h-[22rem] bg-surface/35 p-7 transition-colors hover:bg-surface/75 sm:p-9 ${index > 0 ? "border-t border-line md:border-t-0 md:border-l" : ""}`}>
                  <div className={`grid h-11 w-11 place-items-center rounded-md text-xs font-bold tracking-wider shadow-[0_5px_0_rgb(24_24_27/0.12)] transition-transform duration-300 group-hover:-translate-y-1 ${step.color}`}>{step.n}</div>
                  <h3 className="mt-12 max-w-xs text-2xl font-semibold tracking-[-0.025em] text-ink">{step.title}</h3>
                  <p className="mt-4 max-w-sm leading-relaxed text-muted">{step.body}</p>
                  <p className="absolute right-7 bottom-7 left-7 border-t border-line pt-4 text-[0.68rem] font-bold tracking-[0.08em] text-faint uppercase sm:right-9 sm:bottom-9 sm:left-9">{step.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="inside" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-[0.7rem] font-bold tracking-[0.09em] text-accent-soft uppercase">Inside Midore</p>
              <h2 className="mt-3 text-4xl leading-tight font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Everything your week needs. Nothing it doesn’t.</h2>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {FEATURES.map(({ Icon, label, tone, title, body, detail }, index) => (
                <article key={title} className={`group flex min-h-[26rem] flex-col border border-line bg-surface p-7 shadow-(--shadow-card) transition duration-300 hover:-translate-y-1 hover:border-line-strong sm:p-9 ${index === 0 ? "lg:translate-y-5" : index === 2 ? "lg:-translate-y-5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className={`grid h-12 w-12 place-items-center rounded-md ${tone}`}><Icon size={23} strokeWidth={1.7} /></div>
                    <span className="text-[0.65rem] font-bold tracking-[0.09em] text-faint">{label}</span>
                  </div>
                  <h3 className="mt-12 text-2xl leading-snug font-semibold tracking-[-0.025em] text-ink">{title}</h3>
                  <p className="mt-4 leading-relaxed text-muted">{body}</p>
                  <p className="mt-auto border-t border-line pt-5 text-xs font-semibold text-ink">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 border border-line bg-surface/70 px-3 py-1.5 text-[0.68rem] font-bold tracking-[0.08em] text-accent-soft uppercase shadow-(--shadow-card)">
                <CalendarClock size={14} /> Built for calendars that are already full
              </span>
              <h2 className="mt-7 max-w-2xl text-4xl leading-[1.04] font-semibold tracking-[-0.045em] text-ink sm:text-6xl">Protect the hours where real work happens.</h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Meetings fill the week first. {APP_NAME} plans around them, keeps your booking availability accurate, and shows you early when a deadline needs attention.
              </p>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {FOCUS.map(({ Icon, color, title, body }, index) => (
                <article key={title} className="grid grid-cols-[auto_1fr_auto] gap-5 py-7">
                  <div className="grid h-10 w-10 place-items-center border border-line bg-surface/70"><Icon size={20} className={color} /></div>
                  <div>
                    <h3 className="text-lg font-medium text-ink">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                  <span className="text-xs font-semibold text-faint">0{index + 1}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {TRUST.map(({ Icon, text, href }) => {
              const contents = <><Icon size={19} strokeWidth={1.7} className="shrink-0 text-accent-soft" /><p className="text-sm font-medium leading-snug text-ink">{text}</p></>;
              return href ? (
                <a key={text} href={href} target="_blank" rel="noreferrer" className="flex min-h-28 items-center gap-4 p-5 transition hover:bg-canvas sm:p-6">{contents}</a>
              ) : (
                <div key={text} className="flex min-h-28 items-center gap-4 p-5 sm:p-6">{contents}</div>
              );
            })}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.65fr_1fr]">
            <div>
              <p className="text-[0.7rem] font-bold tracking-[0.09em] text-accent-soft uppercase">Questions</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">The useful details.</h2>
              <p className="mt-5 max-w-sm leading-relaxed text-muted">Straight answers about your meetings, your data, and what Midore changes.</p>
            </div>
            <div className="border-t border-line">
              {FAQ.map(([question, answer], index) => (
                <details key={question} className="group border-b border-line bg-transparent px-1 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium text-ink">
                    <span className="flex items-center gap-4"><span className="text-xs font-semibold text-faint">0{index + 1}</span>{question}</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center border border-line text-faint transition group-open:rotate-45 group-open:border-accent group-open:text-accent">+</span>
                  </summary>
                  <p className="max-w-2xl pb-6 pl-10 leading-relaxed text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <div aria-hidden className="absolute top-0 left-1/2 h-36 w-[36rem] -translate-x-1/2 bg-accent/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <p className="text-[0.7rem] font-bold tracking-[0.09em] text-accent-soft uppercase">One input. One workable week.</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-ink sm:text-6xl">Start with one brain dump.</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">Clear your head and let {APP_NAME} turn the loose ends into time you can see.</p>
            <div className="mt-9 flex justify-center">{cta}</div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
