import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, SOURCE_URL } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-500">
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/privacy" className="hover:text-slate-800">Privacy policy</Link>
        <Link href="/terms" className="hover:text-slate-800">Terms of service</Link>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hover:text-slate-800">Source code</a>
        {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-slate-800">Contact</a>}
      </nav>
      <p className="mt-3">{APP_NAME} is free and open source (MIT).</p>
    </footer>
  );
}
