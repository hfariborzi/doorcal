import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 text-slate-700">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← {APP_NAME}</Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Terms of service</h1>
        <div className="mt-6 space-y-4 text-sm leading-6">
          <p>
            {APP_NAME} is a free scheduling service. By signing in or booking a meeting, you agree to these terms.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">The service</h2>
          <p>
            {APP_NAME} connects to your Google Calendar so people can book time with you. It is provided free of
            charge, as is, without any warranty. We may change, limit or stop the service at any time. Keep your own
            records of important meetings; your Google Calendar remains the source of truth.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Acceptable use</h2>
          <p>
            Don&apos;t use {APP_NAME} to send spam or unwanted invitations, to harass anyone, to impersonate others,
            or to break the law. Don&apos;t try to overload the service or get around its limits. We may suspend or
            delete accounts that do.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Your account and data</h2>
          <p>
            You are responsible for the event types and booking pages you publish. You can disconnect Google Calendar
            or delete your account at any time from Settings. How we handle data is described in the{" "}
            <Link href="/privacy" className="text-blue-700 underline">privacy policy</Link>.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Liability</h2>
          <p>
            To the extent the law allows, we are not liable for missed, double-booked or lost meetings, or for any
            other loss arising from use of the service.
          </p>
          {CONTACT_EMAIL && (
            <p>
              Questions? Contact <a className="text-blue-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
