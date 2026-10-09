"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, LayoutList, Settings, Timer } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Calendar", Icon: CalendarDays },
  { href: "/dashboard/bookings", label: "Bookings", Icon: Clock },
  { href: "/dashboard/event-types", label: "Event types", Icon: LayoutList },
  { href: "/dashboard/availability", label: "Availability", Icon: Timer },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

export function Nav({ collapsed = false }: { collapsed?: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${collapsed ? "md:justify-center md:px-0" : ""} ${
              active ? "bg-accent text-on-accent shadow-[0_0_16px_rgb(124_58_237/0.3)]" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <Icon size={17} strokeWidth={1.75} />
            <span className={collapsed ? "md:sr-only" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
