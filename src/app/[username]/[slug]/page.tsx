import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getEventType, getUserByUsername } from "@/lib/data";
import { getBookingByUid } from "@/lib/bookings";
import { APP_NAME } from "@/lib/config";
import { BookingFlow, type BookingFlowProps } from "./BookingFlow";

export async function generateMetadata(props: PageProps<"/[username]/[slug]">) {
  const { username, slug } = await props.params;
  const user = await getUserByUsername(username);
  const et = user ? await getEventType(user.id, slug) : null;
  return { title: et ? `${et.title} with ${user!.name || user!.username}` : "Not found" };
}

export default async function EventPage(props: PageProps<"/[username]/[slug]">) {
  await connection();
  const { username, slug } = await props.params;
  const { reschedule } = await props.searchParams;
  const user = await getUserByUsername(username);
  const et = user ? await getEventType(user.id, slug) : null;
  if (!user || !et) notFound();

  if (!et.active) {
    return (
      <main className="mx-auto max-w-lg flex-1 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">This event is not accepting bookings</h1>
        <Link href={`/${user.username}`} className="btn-secondary mt-6">See other events</Link>
      </main>
    );
  }

  let rescheduleInfo: BookingFlowProps["reschedule"];
  if (typeof reschedule === "string") {
    const row = await getBookingByUid(reschedule);
    if (row && row.booking.userId === user.id && row.booking.status === "confirmed") {
      rescheduleInfo = {
        uid: row.booking.uid,
        start: row.booking.start.toISOString(),
        duration: Math.round((row.booking.end.getTime() - row.booking.start.getTime()) / 60_000),
        name: row.booking.name,
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <BookingFlow
        host={{ username: user.username, name: user.name, image: user.image }}
        eventType={{
          slug: et.slug,
          title: et.title,
          description: et.description,
          durations: et.durations,
          locations: et.locations,
          color: et.color,
          questions: et.questions,
          seats: et.seats,
        }}
        reschedule={rescheduleInfo}
      />
      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href={`/${user.username}`} className="hover:underline">More events from {user.name || user.username}</Link>
        {" · "}Powered by <Link href="/" className="hover:underline">{APP_NAME}</Link>
      </p>
    </main>
  );
}
