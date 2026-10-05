import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DateTime } from "luxon";
import { getBookingByUid } from "@/lib/bookings";
import { bookingLocationText, locationIcon } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";
import { APP_NAME } from "@/lib/config";
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
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl" style={{ background: cancelled ? "#fee2e2" : "#dcfce7" }}>
          {cancelled ? "✕" : "✓"}
        </div>
        <h1 className="mt-4 text-2xl font-semibold">
          {cancelled ? "This meeting was cancelled" : wasRescheduled ? "Your meeting was rescheduled" : isNew ? "You are scheduled" : "Your booking"}
        </h1>
        {!cancelled && (isNew || wasRescheduled) && (
          <p className="mt-2 text-sm text-slate-600">A calendar invitation has been sent to {booking.email}.</p>
        )}
        {cancelled && booking.cancelReason && (
          <p className="mt-2 text-sm text-slate-600">Reason: {booking.cancelReason}</p>
        )}

        <div className="mt-8 space-y-3 rounded-xl border border-slate-200 p-5 text-left text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={hostName} image={host.image} size={36} />
            <div>
              <div className="font-semibold">{booking.title}</div>
              <div className="text-slate-500">with {hostName}</div>
            </div>
          </div>
          <div className={`flex gap-2 ${cancelled ? "line-through text-slate-400" : ""}`}>
            <span>📅</span>
            <span>
              {s.toFormat("h:mm a")} – {e.toFormat("h:mm a")}, {s.toFormat("cccc, LLLL d, yyyy")}
            </span>
          </div>
          <div className="flex gap-2">
            <span>🌐</span>
            <span>{tz.replace(/_/g, " ")}</span>
          </div>
          <div className="flex gap-2">
            <span>{locationIcon(booking.location.type)}</span>
            {booking.meetLink && !cancelled ? (
              <a href={booking.meetLink} className="text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                Join Google Meet
              </a>
            ) : (
              <span>{bookingLocationText(booking.location)}</span>
            )}
          </div>
          <div className="flex gap-2">
            <span>👤</span>
            <span>
              {booking.name} ({booking.email})
              {booking.guests.length > 0 && ` + ${booking.guests.join(", ")}`}
            </span>
          </div>
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
            <p className="mt-6 text-xs text-slate-500">
              Bookmark this page to reschedule or cancel later.
            </p>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href={`/${host.username}`} className="hover:underline">Book another meeting with {hostName}</Link>
        {" · "}Powered by <Link href="/" className="hover:underline">{APP_NAME}</Link>
      </p>
    </main>
  );
}
