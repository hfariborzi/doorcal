import Link from "next/link";
import { Wordmark } from "@/components/Logo";

/** Small credit line under public booking pages. */
export function PoweredBy({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-faint">
      {children}
      <Link href="/" className="hover:text-ink">
        Powered by <Wordmark markClassName="" />
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-ink">Terms</Link>
    </p>
  );
}
