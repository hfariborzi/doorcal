import { Link2, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { requestBaseUrl } from "@/lib/origin";
import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { GoogleButton } from "@/components/GoogleButton";
import { Logo } from "@/components/Logo";
import { Nav } from "./Nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const publicUrl = `${await requestBaseUrl()}/${user.username}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-black/20 px-3 py-4 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="mb-4 px-2 md:mb-8">
          <Logo href="/dashboard" />
        </div>
        <Nav />
        <div className="mt-auto hidden space-y-1 border-t border-line pt-4 md:block">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.name || user.email} image={user.image} size={32} />
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium text-ink">{user.name}</div>
              <div className="truncate text-xs text-faint">{user.email}</div>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost w-full justify-start px-2">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 text-sm sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-muted hover:text-ink"
              title="Your public booking page"
            >
              <Link2 size={15} className="shrink-0" />
              <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
            </a>
            <CopyButton text={publicUrl} className="btn-secondary py-1.5" />
          </div>
          <form action="/api/auth/logout" method="post" className="md:hidden">
            <button className="btn-ghost py-1.5">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
        {!user.googleRefreshToken && (
          <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning/25 bg-warning/5 px-5 py-4 sm:mx-8">
            <div className="max-w-xl text-sm text-muted">
              <strong className="text-ink">Connect your Google Calendar.</strong> People can&apos;t book you until{" "}
              {APP_NAME} can see when you&apos;re busy and add meetings. On Google&apos;s consent screen, tick all three
              calendar permissions.
            </div>
            <div className="w-64">
              <GoogleButton reconnect label="Connect Google Calendar" />
            </div>
          </div>
        )}
        <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
