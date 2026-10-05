# DoorCal

Open-source scheduling that runs on your Google or Microsoft calendar. People sign in once, set when they're
free, and share a link. Invitees pick a time, and the meeting goes straight onto the host's calendar, with a
Google Meet or Microsoft Teams link if it's an online meeting.

Think Calendly, but self-hostable and MIT-licensed.

## Features

- **Sign in with Google or Microsoft.** One consent screen. Any number of users, each with their own page at `/{username}`.
- **Several accounts per user.** Connect any mix of Google and Microsoft accounts (work and personal); sign in with any of them. Every ticked calendar blocks your availability, and you choose which calendar each kind of booking goes to.
- **Live conflict checking** across all connected calendars, so you're never double-booked.
- **Your calendars in the dashboard.** Week and day views across your accounts. Click an empty slot to create a meeting.
- **Event types**, each with its own link:
  - one or more durations the invitee can choose from (15 / 30 / 60 min…)
  - locations: **video call** (a Google Meet or Microsoft Teams link, created automatically), **in person**, **phone** (you call them, or they call you), or **any custom link** (Zoom…). Offer several and let the invitee choose.
  - **one-on-one** or **group** events with a seat limit (office hours, workshops)
  - buffers before and after, minimum notice, booking window, start-time interval, daily cap
  - custom invitee questions (text, long text, phone, dropdown)
  - secret events (bookable by link, hidden from your profile)
- **Availability schedules.** Weekly hours with several ranges per day, date overrides and days off, a time zone per schedule, and multiple schedules (e.g. "Office hours" and "Evenings").
- **Self-serve reschedule and cancel** for invitees. Google Calendar updates and everyone gets notified.
- **Host tools.** Upcoming, past and cancelled bookings; cancel with a reason; pick which calendar bookings are written to.
- Time zone detection and a picker for invitees, a 12h/24h toggle, and layouts that work on mobile.
- Invitations, updates and cancellations are sent by Google Calendar or Outlook itself, so there's no email service to set up.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Postgres via Drizzle ORM · Google Calendar API · Microsoft Graph · Luxon.
It runs entirely on serverless functions (Vercel), with no server to maintain.

## Self-hosting

You need a Google Cloud project for OAuth (and optionally a Microsoft app registration), a Postgres database and
a place to run Next.js. The steps below use Vercel and Neon; both have free tiers.

### 1. Google Cloud

1. Create a project at <https://console.cloud.google.com>.
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (shown as "Google Auth Platform" in newer consoles):
   - User type: **External**.
   - App name, support email, logo (optional).
   - App domain: your homepage (`https://your-domain`) and privacy policy (`https://your-domain/privacy`; the app includes one).
   - Authorized domains: your root domain (e.g. `example.com`).
   - Scopes: `openid`, `email`, `profile`, plus these three Calendar scopes (the narrowest that cover what the
     app does):
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
     - `https://www.googleapis.com/auth/calendar.freebusy`
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URIs:
     - `https://your-domain/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback` (for local development)
   - Copy the **Client ID** and **Client secret**.
5. **Publish the app.** While the consent screen is in *Testing*, only listed test users can sign in and Google
   **expires refresh tokens after 7 days**, which silently disconnects calendars. Click **Publish app** to move to
   *In production*. Until Google verifies the app, users see an "unverified app" warning they can click through,
   and you're limited to 100 users. To remove both, submit the app for verification. The calendar scope is a
   *sensitive* scope (not *restricted*), so verification needs a scope justification and a short demo video, not a
   security audit.

> **Google Workspace accounts** (company or university domains) may block unverified third-party apps. If sign-in
> says "access blocked", ask your Workspace admin to trust the OAuth client ID under
> *Admin console → Security → API controls → App access control*.

### 1b. Microsoft (optional)

Skip this to offer Google sign-in only; the Microsoft button appears once both variables below are set.

1. In the [Microsoft Entra admin center](https://entra.microsoft.com) go to **App registrations → New registration**.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI (Web): `https://your-domain/api/auth/microsoft/callback` (add `http://localhost:3000/api/auth/microsoft/callback` for development).
2. **Certificates & secrets → New client secret.** Copy the value; it expires (24 months at most), so note the date.
3. **API permissions → Add → Microsoft Graph → Delegated:** `openid`, `email`, `profile`, `offline_access`, `User.Read`, `Calendars.ReadWrite`.
4. Copy the **Application (client) ID** into `MICROSOFT_CLIENT_ID` and the secret into `MICROSOFT_CLIENT_SECRET`.
5. Optional: complete **publisher verification** (Branding & properties) so users don't see an "unverified" label.
6. Only if you restrict sign-up with `ALLOWED_EMAILS` / `ALLOWED_DOMAINS`: under **Token configuration → Add
   optional claim → ID**, add `xms_edov`. With an allow-list set, DoorCal only accepts Microsoft accounts whose
   email domain Microsoft has verified, because a tenant can otherwise claim any address.

> Organizations often require an admin to approve third-party apps. If sign-in says approval is needed, the
> user's IT department has to allow the app once for the whole organization.

### 2. Deploy to Vercel

1. Fork or push this repo to GitHub, then **Import** it at <https://vercel.com/new>.
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`.
3. In **Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `APP_URL` | `https://your-domain` (no trailing slash) |
   | `GOOGLE_CLIENT_ID` | from step 1 |
   | `GOOGLE_CLIENT_SECRET` | from step 1 |
   | `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | optional, from step 1b |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `NEXT_PUBLIC_APP_NAME` | optional display name |
   | `CONTACT_EMAIL` | contact address shown in the footer, privacy policy and terms (recommended for public instances) |
   | `ALLOWED_EMAILS` / `ALLOWED_DOMAINS` | optional, comma-separated, to restrict who can sign up |
   | `MIGRATE_PREVIEWS` | optional; `true` runs migrations on preview builds (only if previews use their own database branch) |

4. Redeploy. Database migrations run automatically during production builds (`scripts/migrate.mjs`). Preview builds
   skip them unless `MIGRATE_PREVIEWS=true`, so a preview can't change a shared production database.

### 3. Custom domain (e.g. a subdomain on Cloudflare)

1. Vercel → **Settings → Domains** → add `book.example.com`.
2. Cloudflare → **DNS** → add a record:
   - Type `CNAME`, Name `book`, Target `cname.vercel-dns.com`
   - Proxy status: **DNS only** (grey cloud). Vercel issues the TLS certificate itself.
3. Set `APP_URL=https://book.example.com` and make sure the same URL is in the Google (and Microsoft) redirect URIs.

## Local development

You need Node.js 20+, Docker (for Postgres) and a Google OAuth client (step 1 above, with the
`http://localhost:3000/api/auth/google/callback` redirect URI).

```bash
cp .env.example .env.local   # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET
docker compose up -d         # local Postgres; DATABASE_URL in .env.example already points at it
npm install
npm run db:migrate
npm run dev                  # http://localhost:3000
```

For local testing you don't need to publish the Google app: leave it in *Testing* and add your Google account as a
test user (tokens then expire after 7 days; just reconnect).

Any Postgres 13+ works (the app uses the `btree_gist` extension, included in standard Postgres). Neon URLs use
Neon's serverless HTTP driver; everything else uses node-postgres.

Other scripts: `npm test` (slot engine tests), `npm run typecheck`, `npm run lint`,
`npm run db:generate` (create a migration after editing `src/db/schema.ts`), `npm run db:studio`.

## How it works

- `src/lib/availability.ts` is the pure slot engine. It takes weekly hours, overrides, busy times, buffers,
  notice, limits and seats, and returns bookable start times. Unit tests live next to it.
- `src/lib/calendar/` holds one module per provider (Google Calendar API, Microsoft Graph) behind a shared
  interface: busy times, calendar list, events, and creating, moving and deleting events with Meet or Teams links.
  `index.ts` resolves which of a user's connected accounts to use for what.
- Sign-in and "connect another account" share `src/lib/oauth.ts`: PKCE, a nonce, and a signed state cookie that
  binds a connect flow to the user who started it. Accounts are matched by the provider's stable account id,
  never by email address, so nobody can attach someone else's account to theirs.
- `src/lib/bookings.ts` handles creating, cancelling and rescheduling bookings. Each action re-checks the slot on the
  server and keeps the Google event in sync. Group events share one Google event and add or remove attendees.
- Refresh tokens are encrypted at rest with AES-256-GCM, using a key derived from `AUTH_SECRET`.
- Sessions are signed JWT cookies. `src/proxy.ts` guards `/dashboard`.
- A Postgres exclusion constraint stops two people booking overlapping one-on-one slots at the same moment.
- Public endpoints (slots, booking, cancel, reschedule) are rate-limited per IP with a small Postgres table, so
  there's no extra service to run.

## Roadmap ideas

Contributions are welcome. Some ideas:

- Email reminders and follow-ups
- Round-robin and collective (multi-host) events
- Apple iCloud and other CalDAV calendars
- Embeddable booking widget
- Payments for paid sessions
- Meeting polls

## License

MIT
