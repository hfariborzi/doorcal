"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Calendar", icon: "🗓️" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📋" },
  { href: "/dashboard/event-types", label: "Event types", icon: "🧩" },
  { href: "/dashboard/availability", label: "Availability", icon: "⏰" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const active = i.href === "/dashboard" ? path === i.href : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
