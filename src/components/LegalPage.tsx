import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";

/** Shared layout for the privacy policy and terms of service. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-slate-700">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← {APP_NAME}</Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
        <div className="mt-8 space-y-4 text-[15px] leading-7 [&_a]:text-blue-700 [&_a]:underline [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-slate-900 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function ContactLine({ email }: { email: string }) {
  return email ? (
    <p>
      Email <a href={`mailto:${email}`}>{email}</a>. We aim to reply within 7 days.
    </p>
  ) : (
    <p>Contact details for this instance have not been configured yet.</p>
  );
}
