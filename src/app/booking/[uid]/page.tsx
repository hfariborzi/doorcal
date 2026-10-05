import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DateTime } from "luxon";
import { CalendarDays, Check, Globe, User, Video, X } from "lucide-react";
import { getBookingByUid } from "@/lib/bookings";
import { bookingLocationText, meetingLinkLabel } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";
import { LocationIcon } from "@/components/LocationIcon";
import { PoweredBy } from "@/components/PoweredBy";
import { CancelBooking } from "./CancelBooking";

export const metadata = { title: "Your booking", robots: { index: false } };

function hasEnded(end: Date) {
  return end.getTime() < Date.now();
}

export default async function BookingPage(props: PageProps<"/booking/[uid]">) {
  await connection();
  const { uid } = await props.params;
  const sp = await props.searchParams;
  const row = await getBookingByUid(uid);
  if (!row) notFound();
  const { booking, host, eventType } = row;

  const tz = booking.timezone;
  const s = DateTime.fromJSDate(booking.start).setZone(tz);
  const e = DateTime.fromJSDate(booking.end).setZone(tz);
  const cancelled = booking.status === "cancelled";
  const past = hasEnded(booking.end);
  const isNew = sp.new === "1";
  const wasRescheduled = sp.rescheduled === "1";
  const hostName = host.name || host.username;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <div className="text-center">
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full ring-1 ${
            cancelled ? "bg-danger/10 text-danger ring-danger/30" : "bg-accent/20 text-accent-soft ring-accent/40"
          }`}
        >
          {cancelled ? <X size={26} /> : <Check size={26} />}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {cancelled ? "This meeting was cancelled" : wasRescheduled ? "Your meeting was rescheduled" : isNew ? "You are scheduled" : "Your booking"}
        </h1>
        {!cancelled && (isNew || wasRescheduled) && (
          <p className="mt-3 text-sm text-muted">A calendar invitation has been sent to {booking.email}.</p>
        )}
        {cancelled && booking.cancelReason && <p className="mt-3 text-sm text-muted">Reason: {booking.cancelReason}</p>}
      </div>

      <div className="card mt-10 p-6">
        <div className="flex items-center gap-3 border-b border-line pb-5">
          <Avatar name={hostName} image={host.image} size={40} />
          <div>
            <div className="font-semibold text-ink">{booking.title}</div>
            <div className="text-sm text-muted">with {hostName}</div>
          </div>
        </div>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex gap-3">
            <CalendarDays size={18} className="mt-0.5 shrink-0 text-accent-soft" />
            <div className={cancelled ? "text-faint line-through" : ""}>
              <dt className="font-medium text-ink">{s.toFormat("cccc, LLLL d, yyyy")}</dt>
              <dd className="text-muted tnum">{s.toFormat("h:mm a")} – {e.toFormat("h:mm a")}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Globe size={18} className="mt-0.5 shrink-0 text-accent-soft" />
            <dd className="text-muted">{tz.replace(/_/g, " ")}</dd>
          </div>
          <div className="flex gap-3">
            <LocationIcon type={booking.location.type} size={18} className="mt-0.5 shrink-0 text-accent-soft" />
            <dd className="min-w-0 text-muted">
              {booking.meetLink && !cancelled ? (
                <a href={booking.meetLink} className="link" target="_blank" rel="noreferrer">Join {meetingLinkLabel(booking.meetLink)}</a>
              ) : (
                bookingLocationText(booking.location)
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <User size={18} className="mt-0.5 shrink-0 text-accent-soft" />
            <dd className="min-w-0 break-words text-muted">
              {booking.name} ({booking.email})
              {booking.guests.length > 0 && ` + ${booking.guests.join(", ")}`}
            </dd>
          </div>
        </dl>

        {booking.meetLink && !cancelled && !past && (
          <a href={booking.meetLink} target="_blank" rel="noreferrer" className="btn-primary mt-6 w-full py-2.5">
            <Video size={16} /> Join with {meetingLinkLabel(booking.meetLink)}
          </a>
        )}
      </div>

      {!cancelled && !past && (
        <>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {eventType && (
              <Link href={`/${host.username}/${eventType.slug}?reschedule=${booking.uid}`} className="btn-secondary">
                Reschedule
              </Link>
            )}
            <CancelBooking uid={booking.uid} />
          </div>
          <p className="mt-6 text-center text-xs text-faint">Bookmark this page to reschedule or cancel later.</p>
        </>
      )}
      <PoweredBy>
        <Link href={`/${host.username}`} className="hover:text-ink">Book another time with {hostName}</Link>
        <span aria-hidden>·</span>
      </PoweredBy>
    </main>
  );
}
