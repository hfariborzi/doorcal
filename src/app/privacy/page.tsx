import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, SOURCE_URL } from "@/lib/config";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy policy",
  description: `How ${APP_NAME} collects, uses, shares, protects and deletes your data, including Google user data.`,
};

const UPDATED = "October 5, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated={UPDATED}>
      <p>
        {APP_NAME} is a free, open-source scheduling service. People connect their Google Calendar, publish booking
        links, and others use those links to book meetings with them. This policy explains what data {APP_NAME}{" "}
        collects, how it is used and shared, how it is protected, and how you can delete it. It applies to the
        service at doorcal.com. Copies of the{" "}
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">open-source code</a> run by other people are separate
        services with their own policies.
      </p>
      <p>
        In this policy, a <strong>host</strong> is someone who signs in with Google and shares booking links, and an{" "}
        <strong>invitee</strong> is someone who books a meeting through a host&apos;s link.
      </p>

      <h2>1. Information we collect</h2>
      <h3>From hosts, through Google sign-in</h3>
      <ul>
        <li>Your name, email address, profile picture and Google account ID.</li>
        <li>
          An OAuth refresh token that lets {APP_NAME} reach your Google Calendar while you are not on the site, for
          example when someone books you. It is stored encrypted.
        </li>
      </ul>
      <h3>From hosts, through Google Calendar</h3>
      <p>{APP_NAME} asks for three Google Calendar permissions and uses each one only as described here:</p>
      <ul>
        <li>
          <strong>See your free/busy information</strong> (<code>calendar.freebusy</code>). When someone opens your
          booking page or books a time, we check which times you are busy across the calendars you chose, so nobody
          can book you when you are not free. We only receive busy time ranges, not event details, and we don&apos;t
          store them.
        </li>
        <li>
          <strong>See the list of your calendars</strong> (<code>calendar.calendarlist.readonly</code>). On the
          Settings page we list your calendars so you can choose which ones count for conflicts and which one new
          bookings go to. We store only the IDs of the calendars you select.
        </li>
        <li>
          <strong>View and edit events on your calendars</strong> (<code>calendar.events</code>). We use this to
          show your events in your {APP_NAME} dashboard, to create the calendar event (with a Google Meet link for
          online meetings) when someone books you or when you create a meeting in {APP_NAME}, to update it when a
          booking is rescheduled, and to delete it or remove an attendee when a booking is cancelled. We store the ID
          and Google Meet link of events {APP_NAME} creates for bookings. We don&apos;t store the contents of your
          other events; they are fetched when you view your dashboard and not kept.
        </li>
      </ul>
      <h3>Settings hosts create</h3>
      <p>
        Your username, display name, headline, welcome message, time zone, availability schedules and event types,
        including any questions you ask invitees.
      </p>
      <h3>From invitees</h3>
      <p>
        When you book a meeting we collect the details you enter: your name, email address, any guest email
        addresses, a phone number if the meeting is a phone call, your answers to the host&apos;s questions, your
        notes, and your time zone. Invitees don&apos;t need an account and we don&apos;t access invitees&apos;
        calendars.
      </p>
      <h3>Technical information</h3>
      <ul>
        <li>
          Cookies: a session cookie that keeps hosts signed in (30 days) and a short-lived cookie used during Google
          sign-in (10 minutes). We don&apos;t use analytics, advertising or tracking cookies.
        </li>
        <li>
          IP addresses, used to limit abuse of booking pages. We store only a one-way hash of your IP address in
          short-lived request counters, never the address itself.
        </li>
        <li>Standard request logs kept by our hosting provider for operating and securing the service.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide scheduling: show availability, take bookings, and create, update and cancel calendar events.</li>
        <li>To show hosts their calendar, bookings and settings in the dashboard.</li>
        <li>To let invitees view, reschedule or cancel their own booking.</li>
        <li>To keep the service secure and working, including preventing spam and abuse.</li>
      </ul>
      <p>We don&apos;t use your data for advertising, we don&apos;t sell it, and we don&apos;t build profiles of you.</p>

      <h2>3. Google user data and Limited Use</h2>
      <p>
        {APP_NAME}&apos;s use and transfer to any other app of information received from Google APIs will adhere to{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <ul>
        <li>We use Google user data only to provide and improve the scheduling features you use.</li>
        <li>We don&apos;t transfer it to others except as needed to provide the service, to comply with law, or as part of a merger or acquisition with notice to you.</li>
        <li>We don&apos;t use it for advertising, including retargeting, personalized or interest-based ads.</li>
        <li>We don&apos;t sell it, and we don&apos;t use it to train or improve generalized AI or machine-learning models.</li>
        <li>
          No person reads your Google data unless you ask us to (for example for support), it is needed for
          security or to investigate abuse, or the law requires it.
        </li>
      </ul>

      <h2>4. How information is shared</h2>
      <ul>
        <li>
          <strong>Between host and invitee.</strong> When an invitee books, the host sees the details the invitee
          entered, and both see the meeting details. These details are written into the host&apos;s Google Calendar
          event, and Google sends the invitation and any updates to the invitee and their guests.
        </li>
        <li>
          <strong>Service providers</strong> that run {APP_NAME} for us and may process data only on our
          instructions: Vercel (hosting) and Neon (database). Data may be processed in the United States and other
          countries where these providers operate.
        </li>
        <li><strong>Google</strong>, to read and update your calendar as described above.</li>
        <li><strong>When required by law</strong>, or to protect the rights, safety and security of users and the service.</li>
      </ul>
      <p>We don&apos;t sell or rent personal information to anyone.</p>

      <h2>5. How information is protected</h2>
      <ul>
        <li>All traffic to {APP_NAME} is encrypted with HTTPS.</li>
        <li>Google refresh tokens are encrypted at rest with AES-256-GCM. We don&apos;t store Google access tokens.</li>
        <li>
          A host&apos;s dashboard, calendar and bookings are available only to that host after signing in. A
          host&apos;s public profile and event types are visible to anyone with the link, by design. Invitees can
          reach only their own booking, through its private link.
        </li>
        <li>Our database provider encrypts stored data, and access to production systems is limited to the operator.</li>
      </ul>
      <p>No system is perfectly secure, but we work to protect your data and will notify affected users of a breach as required by law.</p>

      <h2>6. How long we keep data, and how to delete it</h2>
      <ul>
        <li>
          <strong>Hosts:</strong> your data is kept while your account exists. You can delete your account at any
          time in <strong>Settings → Delete account</strong>. This immediately deletes your profile, settings, event
          types, schedules and booking history from our database and revokes {APP_NAME}&apos;s access to your
          Google account. Calendar events already on your Google Calendar stay there, under your control.
        </li>
        <li>
          <strong>Disconnecting Google</strong> (Settings → Disconnect) deletes the stored token and revokes access
          without deleting your account. You can also revoke access at any time at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        </li>
        <li>
          <strong>Invitees:</strong> booking details are kept as part of the host&apos;s booking history until the
          host deletes their account, or until you ask us to delete them.
        </li>
        <li>Deleted data may remain in our database provider&apos;s backups for a short period (up to about 30 days) before it is overwritten.</li>
      </ul>

      <h2>7. Your choices and rights</h2>
      <p>
        You can see and change your data in the dashboard, and delete it as described above. You can also ask us to
        access, correct, export or delete your personal information, including booking details you entered as an
        invitee, by contacting us. Depending on where you live, you may have further rights under privacy laws such
        as PIPEDA, the GDPR or US state laws, and you may complain to your data protection authority.
      </p>

      <h2>8. Children</h2>
      <p>
        {APP_NAME} is not directed to children under 13 and we don&apos;t knowingly collect their personal
        information. If you believe a child has given us information, contact us and we will delete it.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will post any changes on this page and update the date above. If a change materially affects how we use
        Google user data or other personal information, we will tell hosts by email before it takes effect.
      </p>

      <h2>10. Contact</h2>
      <ContactLine email={CONTACT_EMAIL} />
      <p>
        See also the <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
