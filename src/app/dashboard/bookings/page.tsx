import Link from "next/link";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, bookings } from "@/db";
import { requireUser } from "@/lib/auth";
import { syncDeletedBookings } from "@/lib/bookings";
import { bookingLocationText } from "@/lib/locations";
import { LocationIcon } from "@/components/LocationIcon";
import { HostCancel } from "./HostCancel";

export const metadata = { title: "Bookings" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function BookingsPage(props: PageProps<"/dashboard/bookings">) {
  const user = await requireUser();
  const { tab: rawTab } = await props.searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "upcoming";
  const now = new Date();

  const where =
    tab === "cancelled"
      ? and(eq(bookings.userId, user.id), eq(bookings.status, "cancelled"))
      : tab === "past"
        ? and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed"), lt(bookings.end, now))
        : and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed"), gte(bookings.end, now));

  let rows = await db
    .select()
    .from(bookings)
    .where(where)
    .orderBy(tab === "upcoming" ? asc(bookings.start) : desc(bookings.start))
    .limit(200);

  if (tab === "upcoming" && user.googleRefreshToken) {
    // Meetings the host deleted straight from Google Calendar: show them as cancelled, not upcoming.
    const gone = await syncDeletedBookings(user, rows.slice(0, 50));
    if (gone.size) rows = rows.filter((b) => !gone.has(b.uid));
  }

  const tz = user.timezone;
  const dayOf = (d: Date) => DateTime.fromJSDate(d).setZone(tz).toFormat("cccc, LLLL d, yyyy");
  const items = rows.map((b, i) => ({
    b,
    header: i === 0 || dayOf(rows[i - 1].start) !== dayOf(b.start) ? dayOf(b.start) : null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted">Meetings people booked through your links. Times shown in {tz.replace(/_/g, " ")}.</p>
      </div>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/bookings?tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-accent text-accent-soft" : "border-transparent text-faint hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-12 text-center text-sm text-faint">No {tab} bookings.</div>
      ) : (
        <div className="card divide-y divide-line">
          {items.map(({ b, header }) => {
            const s = DateTime.fromJSDate(b.start).setZone(tz);
            const e = DateTime.fromJSDate(b.end).setZone(tz);
            return (
              <div key={b.id}>
                {header && <div className="eyebrow bg-black/20 px-5 py-2.5">{header}</div>}
                <div className="flex flex-wrap items-start gap-4 px-5 py-4">
                  <div className="w-36 shrink-0 text-sm font-medium tnum">
                    {s.toFormat("h:mm a")} – {e.toFormat("h:mm a")}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-semibold">{b.title}</div>
                    <div className="text-muted">
                      {b.name} · <a href={`mailto:${b.email}`} className="hover:underline">{b.email}</a>
                      {b.guests.length > 0 && <span className="text-faint"> + {b.guests.length} guest{b.guests.length > 1 ? "s" : ""}</span>}
                    </div>
                    <div className="mt-1 text-faint">
                      <LocationIcon type={b.location.type} size={14} className="mr-1.5 inline align-[-2px]" />
                      {b.meetLink && b.status === "confirmed" ? (
                        <a href={b.meetLink} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">{b.meetLink}</a>
                      ) : (
                        bookingLocationText(b.location)
                      )}
                    </div>
                    {Object.keys(b.answers).length > 0 && (
                      <dl className="mt-2 space-y-0.5 text-muted">
                        {Object.entries(b.answers).filter(([, v]) => v).map(([k, v]) => (
                          <div key={k}><span className="text-faint">{k}:</span> {v}</div>
                        ))}
                      </dl>
                    )}
                    {b.notes && <p className="mt-2 whitespace-pre-line text-muted">“{b.notes}”</p>}
                    {b.status === "cancelled" && (
                      <p className="mt-2 text-danger">
                        Cancelled by {b.cancelledBy === "host" ? "you" : "invitee"}
                        {b.cancelReason ? `: ${b.cancelReason}` : ""}
                      </p>
                    )}
                  </div>
                  {tab === "upcoming" && <HostCancel uid={b.uid} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
