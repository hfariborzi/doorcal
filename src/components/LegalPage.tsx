import { SiteFooter } from "@/components/SiteFooter";
import { Logo } from "@/components/Logo";

/** Shared layout for the privacy policy and terms of service. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 text-muted">
        <Logo />
        <h1 className="mt-14 text-4xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-3 text-sm text-faint">Last updated: {updated}</p>
        <div className="mt-10 space-y-4 text-base leading-7 [&_a]:text-accent-soft [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-hover [&_code]:px-1 [&_code]:text-sm [&_h2]:pt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:marker:text-faint">
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
