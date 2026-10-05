import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { calendarsForAccounts, isConnected, listAccounts, writeTargets } from "@/lib/calendar";
import { listSchedules } from "@/lib/data";
import { EventTypeForm } from "../EventTypeForm";

export const metadata = { title: "New event type" };

export default async function NewEventTypePage() {
  const user = await requireUser();
  const schedules = await listSchedules(user.id);
  const accounts = await listAccounts(user.id);
  const targets = writeTargets(await calendarsForAccounts(accounts.filter(isConnected)));
  const defaultTarget = targets.find((t) => t.value === `${user.writeAccountId}:${user.writeCalendarId}`)?.label ?? "your main calendar";
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/event-types" className="text-sm text-faint hover:text-ink">← Event types</Link>
      <h1 className="text-3xl font-semibold tracking-tight">New event type</h1>
      <EventTypeForm
        username={user.username}
        schedules={schedules.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault }))}
        targets={targets}
        defaultTarget={defaultTarget}
        initial={{
          writeTarget: null,
          title: "",
          slug: "",
          description: "",
          durations: [30],
          locations: [{ type: "online" }],
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
