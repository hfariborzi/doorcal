import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 text-slate-700">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← {APP_NAME}</Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Privacy policy</h1>
        <div className="mt-6 space-y-4 text-sm leading-6">
          <p>
            {APP_NAME} is an open-source scheduling tool. This page explains what data this instance stores and why.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">If you sign in with Google</h2>
          <p>
            We store your name, email address, profile picture and an encrypted OAuth refresh token for Google Calendar.
            We ask Google for three calendar permissions: to see your free/busy times, to see the list of your
            calendars, and to view and edit events. We use them only to check when you are busy so others can&apos;t
            double-book you, to show your events in your dashboard, to let you pick which calendars count, and to
            create, update or cancel the meetings booked through your links or that you create here. We don&apos;t
            store the contents of your calendar events, and we don&apos;t sell or share your data, use it for
            advertising, or use it to train AI models.
          </p>
          <p>
            Our use of information received from Google APIs follows the{" "}
            <a className="text-blue-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">If you book a meeting</h2>
          <p>
            We store the name, email address, guest emails, notes and answers you enter, and share them with the person
            you booked. Your details go on that person&apos;s Google Calendar event, and Google sends you the invitation.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Deleting your data</h2>
          <p>
            You can disconnect Google Calendar or delete your account at any time from Settings. Deleting your account
            removes your profile, event types and booking history from our database and revokes our access to your Google
            account. You can also revoke access at{" "}
            <a className="text-blue-700 underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              myaccount.google.com/permissions
            </a>
            .
          </p>
          {CONTACT_EMAIL && (
            <>
              <h2 className="pt-2 text-lg font-semibold text-slate-900">Contact</h2>
              <p>
                Questions about your data? Email{" "}
                <a className="text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
