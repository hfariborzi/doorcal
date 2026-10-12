# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Busy people with full calendars, usually professionals who take a lot of meetings, juggling work, deadlines and the rest of life: friends, family, workouts, chores and rest. They usually already use Google Calendar or Outlook, a separate to-do list, and a booking link tool. Their job: get a week, and a life, that actually works, without manually shuffling things into gaps and without double-booking.

## Product Purpose

Midore is a calendar that plans your week. It brings three things people usually pay for separately into one place: a booking page (like Calendly), a task list with projects, and a planner that fits tasks into the free time between meetings. An optional assistant, Dori, takes a brain dump by text or voice and turns it into tasks and a plan. Midore manages life, not only work: on a free Sunday Dori can suggest catching up with friends, a workout, tidying up, or simply resting, and offer ideas for how to unwind. Success: a visitor connects a calendar, empties their head once, and sees a realistic, balanced week.

## Positioning

- Planning that never touches meetings: the planner is plain, deterministic code that places only the user's own work into gaps, in deadline order. It never moves or deletes events; blocks can be pinned and Dori's changes undone.
- Booking, tasks and planning in one product, on top of the calendars people already have (Google and Microsoft, any number of accounts).
- AI is optional and off by default; when on, it runs on providers that keep no copy of data and never train on it.

## Operating Context

Visitors arrive from colleagues' recommendations, comparison searches and launch platforms. They sign in with Google or Microsoft, grant calendar access, and land on a one-screen app: the calendar is always visible; tasks, booking and settings open over it; Dori docks beside it. Invitees use public booking pages at midore.app/{username}/{slug}.

## Capabilities and Constraints

- Shipped: booking pages, multi-account Google and Microsoft calendars, week/day calendar, categories, tasks and projects, deterministic planner, Dori (text and voice, puppy or kitten), calendar push sync.
- Not built: billing and paid plans, notifications or emails sent by Midore, team features, mobile app. Microsoft sign-in is built but not enabled in production.
- Stack: Next.js 16 (App Router), React 19, Tailwind 4, hosted on Vercel.
- Google sign-in buttons must follow Google's branding rules.

## Brand Commitments

- Name: Midore, said "mee-doh-ray", like the notes mi, do, re. Always written "Midore"; the wordmark is lowercase "midore".
- Logo: the "do" mark in `docs/private/design/logo/` and `src/components/Logo.tsx`; on the landing page the mark is shown in the primary colour next to the wordmark.
- Primary colour chosen by the owner: Kyoto vermilion (#e11d48).
- Dori is the in-app assistant: a puppy or a kitten, always called "Dori, your Midore assistant", never "Dory". Real stills and transparent idle videos are in `public/dori/`.
- Wording is general, not aimed at academics.

## Evidence on Hand

- Real product: the calendar, planner and Dori in this repo; Dori artwork and idle videos in `public/dori/`.
- Facts that can be stated: calendar access verified by Google; AI providers keep no copy and never train on data; the code is public on GitHub; made in Canada; booking, tasks, projects and the planner are free.
- None yet: customers, testimonials, usage numbers, press, pricing. Do not invent them.

## Product Principles

1. The calendar the user already has stays the source of truth; Midore never moves other people's meetings.
2. Life, not just work: rest, people and personal time are first-class plans, never leftovers.
3. One input, one workable week: the brain dump is the moment of value.
4. AI is a helper the user switches on, never a requirement.
5. Say only what is true today; no claims about features or plans that do not exist.
