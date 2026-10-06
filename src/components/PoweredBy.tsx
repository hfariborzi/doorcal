import Link from "next/link";
import { FullLogo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Small credit line under public booking pages. */
export function PoweredBy({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-faint">
      {children}
      <Link href="/" className="hover:text-ink">
        Powered by <FullLogo height="0.95em" markClassName="" inline />
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-ink">Terms</Link>
      <span aria-hidden>·</span>
      <ThemeToggle className="px-1.5 py-0.5 text-xs" />
    </p>
  );
}
