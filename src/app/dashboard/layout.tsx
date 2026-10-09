import { cookies } from "next/headers";
import { Link2, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { enabledProviders, isConnected, listAccounts } from "@/lib/calendar";
import { APP_NAME } from "@/lib/config";
import { requestBaseUrl } from "@/lib/origin";
import { CopyButton } from "@/components/CopyButton";
import { ProviderButton } from "@/components/ProviderButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sidebar } from "./Sidebar";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const publicUrl = `${await requestBaseUrl()}/${user.username}`;
  const accounts = await listAccounts(user.id);
  const stale = accounts.filter((a) => !isConnected(a));
  const noneConnected = accounts.every((a) => !isConnected(a));
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar collapsed={collapsed} name={user.name} email={user.email} image={user.image} publicUrl={publicUrl} />
      <div className="min-w-0 flex-1">
        {/* Phones only: on desktop the booking link, theme and sign-out live in the sidebar. */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 text-sm sm:px-8 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 text-muted hover:text-ink"
              title="Your public booking page"
            >
              <Link2 size={15} className="shrink-0" />
              <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
            </a>
            <CopyButton text={publicUrl} className="btn-secondary py-1.5" />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action="/api/auth/logout" method="post">
              <button className="btn-ghost py-1.5">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        </div>
        {stale.length > 0 && (
          <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning/25 bg-warning/5 px-5 py-4 sm:mx-8">
            <div className="max-w-xl text-sm text-muted">
              <strong className="text-ink">
                {noneConnected ? "Connect your calendar." : `Reconnect ${stale.map((a) => a.email).join(", ")}.`}
              </strong>{" "}
              {noneConnected
                ? `People can't book you until ${APP_NAME} can see when you're busy and add meetings.`
                : stale.length === 1
                  ? "Its access expired or was revoked. Booking pages are paused until it's reconnected or removed."
                  : "Their access expired or was revoked. Booking pages are paused until they're reconnected or removed."}{" "}
              Allow all calendar permissions on the consent screen.
            </div>
            <div className="flex flex-wrap gap-2">
              {stale.map((a) => (
                <ProviderButton key={a.id} provider={a.provider} reconnect={a.id} label={`Reconnect ${a.email}`} compact />
              ))}
              {noneConnected && stale.length === 0 && enabledProviders().map((p) => <ProviderButton key={p} provider={p} connect compact />)}
            </div>
          </div>
        )}
        <div className="px-5 py-6 sm:px-8 md:py-6">{children}</div>
      </div>
    </div>
  );
}
