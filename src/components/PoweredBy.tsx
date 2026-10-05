import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LogoMark } from "@/components/Logo";

/** Small credit line under public booking pages. */
export function PoweredBy({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-faint">
      {children}
      <Link href="/" className="inline-flex items-center gap-1.5 hover:text-ink">
        <LogoMark size={15} />
        Powered by {APP_NAME}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-ink">Terms</Link>
    </p>
  );
}
