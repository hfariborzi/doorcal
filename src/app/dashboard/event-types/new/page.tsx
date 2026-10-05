import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSchedules } from "@/lib/data";
import { EventTypeForm } from "../EventTypeForm";

export const metadata = { title: "New event type" };

export default async function NewEventTypePage() {
  const user = await requireUser();
  const schedules = await listSchedules(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/event-types" className="text-sm text-slate-500 hover:text-slate-800">← Event types</Link>
      <h1 className="text-2xl font-semibold">New event type</h1>
      <EventTypeForm
        username={user.username}
        schedules={schedules.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault }))}
        initial={{
          title: "",
          slug: "",
          description: "",
          durations: [30],
          locations: [{ type: "google_meet" }],
          color: "#2563eb",
          scheduleId: null,
          bufferBefore: 0,
          bufferAfter: 0,
          minNotice: 240,
          maxDaysAhead: 60,
          slotInterval: null,
          dailyLimit: null,
          seats: 1,
          questions: [],
          hidden: false,
          active: true,
        }}
      />
    </div>
  );
}
