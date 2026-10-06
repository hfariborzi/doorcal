import Link from "next/link";
import { CONTACT_EMAIL, SOURCE_URL } from "@/lib/config";
import { ThemeToggle } from "./ThemeToggle";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line bg-canvas/85 px-6 py-8 text-center text-sm text-muted backdrop-blur">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-ink">Terms of service</Link>
        <span aria-hidden>·</span>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Source code</a>
        {CONTACT_EMAIL && (
          <>
            <span aria-hidden>·</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          </>
        )}
      </nav>
      <div className="mt-3 flex justify-center">
        <ThemeToggle className="text-xs" />
      </div>
    </footer>
  );
}
