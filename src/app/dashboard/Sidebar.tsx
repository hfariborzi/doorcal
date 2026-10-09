"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { Logo, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Nav } from "./Nav";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";


/**
 * Dashboard navigation. On desktop it can collapse to an icon rail; the choice is remembered in a cookie.
 * On phones it is the bar at the top and never collapses.
 */
export function Sidebar({
  collapsed: initial,
  name,
  email,
  image,
  publicUrl,
}: {
  collapsed: boolean;
  name: string;
  email: string;
  image: string | null;
  publicUrl: string;
}) {
  const [collapsed, setCollapsed] = useState(initial);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };
  const shortUrl = publicUrl.replace(/^https?:\/\//, "");

  return (
    <aside
      className={`border-b border-line bg-well px-3 py-4 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:py-5 ${
        collapsed ? "md:w-[4.25rem] md:px-2" : "md:w-60 md:px-3"
      }`}
    >
      <div className={`mb-4 flex items-center justify-between gap-2 px-2 md:mb-6 ${collapsed ? "md:flex-col md:px-0" : ""}`}>
        <div className={collapsed ? "md:hidden" : ""}>
          <Logo href="/dashboard" />
        </div>
        {collapsed && (
          <Link href="/dashboard" className="hidden md:block" aria-label="DoorCal home">
            <LogoMark size={26} />
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          className="btn-ghost hidden p-1.5 md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <Nav collapsed={collapsed} />

      <div className="mt-5 hidden border-t border-line pt-4 md:block">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-ghost p-2" title={`Open your booking page: ${shortUrl}`} aria-label="Open your booking page">
              <ExternalLink size={17} />
            </a>
            <CopyButton text={publicUrl} iconOnly className="btn-ghost p-2" />
          </div>
        ) : (
          <>
            <p className="eyebrow px-2">Your booking page</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-hover hover:text-ink"
              title="Open your booking page"
            >
              <ExternalLink size={15} className="shrink-0" />
              <span className="truncate">{shortUrl}</span>
            </a>
            <CopyButton text={publicUrl} className="btn-ghost w-full justify-start px-2 py-1.5 text-sm" />
          </>
        )}
      </div>

      <div className={`mt-auto hidden space-y-1 border-t border-line pt-4 md:block ${collapsed ? "md:flex md:flex-col md:items-center" : ""}`}>
        <div className={`flex items-center gap-3 py-2 ${collapsed ? "justify-center" : "px-2"}`} title={collapsed ? `${name}\n${email}` : undefined}>
          <Avatar name={name || email} image={image} size={30} />
          {!collapsed && (
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium text-ink">{name}</div>
              <div className="truncate text-xs text-faint">{email}</div>
            </div>
          )}
        </div>
        <ThemeToggle iconOnly={collapsed} className={collapsed ? "p-2" : "w-full justify-start px-2"} />
        <form action="/api/auth/logout" method="post">
          <button className={`btn-ghost ${collapsed ? "p-2" : "w-full justify-start px-2"}`} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
            {!collapsed && "Sign out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
