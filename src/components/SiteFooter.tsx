import Link from "next/link";
import { CONTACT_EMAIL, SOURCE_URL } from "@/lib/config";
import { FullLogo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas px-4 py-8 text-sm text-muted sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Link href="/" className="text-ink" aria-label="Home">
          <FullLogo height="18px" />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Source code</a>
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          )}
          <ThemeToggle className="text-xs" />
        </nav>
      </div>
    </footer>
  );
}
