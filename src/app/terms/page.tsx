import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, SOURCE_URL } from "@/lib/config";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of service",
  description: `The terms for using ${APP_NAME}, a free scheduling service built on Google Calendar.`,
};

const UPDATED = "October 5, 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated={UPDATED}>
      <p>
        These terms govern your use of {APP_NAME} at doorcal.com, a free scheduling service built on Google
        Calendar and Microsoft calendars. By signing in, or by booking a meeting through a {APP_NAME} link, you agree to these terms and to
        the <Link href="/privacy">privacy policy</Link>. If you don&apos;t agree, please don&apos;t use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        {APP_NAME} lets <strong>hosts</strong> connect their Google or Microsoft calendars, set their availability
        and share booking links, and lets <strong>invitees</strong> book, reschedule and cancel meetings through
        those links. Calendar invitations and updates are sent by Google Calendar or Outlook. The service is free; there are no paid plans.
      </p>

      <h2>2. Who can use it</h2>
      <p>
        You must be at least 13 years old, and old enough to agree to these terms where you live. If you use{" "}
        {APP_NAME} for an organization, you confirm you are allowed to accept these terms for it.
      </p>

      <h2>3. Your account and your calendars</h2>
      <ul>
        <li>Hosts sign in with a Google or Microsoft account and are responsible for activity under their account.</li>
        <li>
          By connecting a calendar you allow {APP_NAME} to check your free/busy times, list your calendars, and
          view, create, update and delete events as described in the privacy policy. You can disconnect at any time.
        </li>
        <li>Your use of Google and Microsoft services is also subject to their own terms.</li>
        <li>
          Your calendar remains the source of truth. Check important meetings there; {APP_NAME} is a tool to
          help you schedule them, not a record you should rely on alone.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>send spam or unwanted invitations, or add people as guests without their permission;</li>
        <li>harass, threaten, deceive or impersonate anyone;</li>
        <li>publish content in event types, profiles or questions that is unlawful or infringes others&apos; rights;</li>
        <li>collect other people&apos;s personal information without a lawful reason;</li>
        <li>overload, probe, or get around the security or limits of the service, or access it by automated means other than normal use of booking pages;</li>
        <li>use the service to break any law.</li>
      </ul>
      <p>We may remove content, limit use, or suspend or delete accounts that break these rules.</p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of what you put into {APP_NAME}: your profile, event types, availability and the details
        you enter when booking. You give us permission to store and process it only as needed to run the service.
        Hosts are responsible for the event types and questions they publish and for how they use invitees&apos;
        details.
      </p>

      <h2>6. Open-source software</h2>
      <p>
        The {APP_NAME} software is open source under the MIT License and available at{" "}
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">{SOURCE_URL.replace(/^https:\/\//, "")}</a>. The
        license covers the code. These terms cover the hosted service at doorcal.com. Instances that other people run
        are not operated by us.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We provide {APP_NAME} free of charge and try to keep it running well, but we don&apos;t guarantee it will
        always be available, uninterrupted or error-free. We may change features, set usage limits, or stop the
        service. If we plan to shut it down, we will try to give hosts at least 30 days&apos; notice by email so
        they can make other arrangements.
      </p>

      <h2>8. Ending your use</h2>
      <p>
        You can stop using {APP_NAME} at any time and delete your account in Settings. We may suspend or end your
        access if you break these terms or if we need to in order to protect users or the service.
      </p>

      <h2>9. Disclaimer</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
        whether express or implied, including warranties of merchantability, fitness for a particular purpose and
        non-infringement, to the extent the law allows.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent the law allows, we are not liable for any indirect, incidental, special or consequential
        damages, or for missed, double-booked or lost meetings, lost data or lost profits, arising from your use of
        the service. Because the service is free, our total liability for any claim is limited to CAD $50. Some
        places don&apos;t allow these limits, so they may not apply to you.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms. We will post changes on this page and update the date above, and tell hosts by
        email about material changes before they take effect. Continuing to use the service after that
        means you accept the updated terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of Canada, without regard to conflict-of-law rules.
      </p>

      <h2>13. Contact</h2>
      <ContactLine email={CONTACT_EMAIL} />
    </LegalPage>
  );
}
