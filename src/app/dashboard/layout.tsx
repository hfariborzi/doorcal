import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { APP_NAME, appUrl } from "@/lib/config";
import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { GoogleButton } from "@/components/GoogleButton";
import { Nav } from "./Nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const publicUrl = `${appUrl(origin)}/${user.username}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <Link href="/" className="mb-6 hidden items-center gap-2 px-2 font-semibold md:flex">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm text-white">◷</span>
          {APP_NAME}
        </Link>
        <Nav />
        <div className="mt-6 hidden space-y-3 border-t border-slate-200 pt-4 md:block">
          <div className="flex items-center gap-2 px-2">
            <Avatar name={user.name || user.email} image={user.image} size={32} />
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost w-full justify-start">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
          <div className="flex min-w-0 items-center gap-2 text-slate-600">
            <span>Your booking page:</span>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-blue-700 hover:underline">
              {publicUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>
          <div className="flex gap-2">
            <CopyButton text={publicUrl} className="btn-secondary py-1.5" />
            <form action="/api/auth/logout" method="post" className="md:hidden">
              <button className="btn-ghost py-1.5">Sign out</button>
            </form>
          </div>
        </div>
        {!user.googleRefreshToken && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-4">
            <div className="text-sm text-amber-900">
              <strong>Connect your Google Calendar.</strong> People can&apos;t book you until {APP_NAME} can see when
              you&apos;re busy and add meetings. Make sure you tick the calendar permission on Google&apos;s consent screen.
            </div>
            <div className="w-64">
              <GoogleButton reconnect label="Connect Google Calendar" />
            </div>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
