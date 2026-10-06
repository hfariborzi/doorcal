import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, eventTypes } from "@/db";
import { requireUser } from "@/lib/auth";
import { calendarsForAccounts, isConnected, listAccounts, writeTargets } from "@/lib/calendar";
import { listSchedules } from "@/lib/data";
import { EventTypeForm } from "../EventTypeForm";

export const metadata = { title: "Edit event type" };

export default async function EditEventTypePage(props: PageProps<"/dashboard/event-types/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const [et] = await db
    .select()
    .from(eventTypes)
    .where(and(eq(eventTypes.id, Number(id) || 0), eq(eventTypes.userId, user.id)));
  if (!et) notFound();
  const schedules = await listSchedules(user.id);
  const accounts = await listAccounts(user.id);
  const targets = writeTargets(await calendarsForAccounts(accounts.filter(isConnected)));
  const defaultTarget = targets.find((t) => t.value === `${user.writeAccountId}:${user.writeCalendarId}`)?.label ?? "your main calendar";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/event-types" className="text-sm text-faint hover:text-ink">← Event types</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{et.title}</h1>
        <a href={`/${user.username}/${et.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">Preview booking page ↗</a>
      </div>
      <EventTypeForm
        key={et.id}
        username={user.username}
        schedules={schedules.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault }))}
        targets={targets}
        defaultTarget={defaultTarget}
        initial={{
          id: et.id,
          writeTarget: et.writeAccountId ? `${et.writeAccountId}:${et.writeCalendarId ?? "primary"}` : null,
          preferences: et.preferences,
          title: et.title,
          slug: et.slug,
          description: et.description,
          durations: et.durations,
          locations: et.locations,
          color: et.color,
          scheduleId: et.scheduleId,
          bufferBefore: et.bufferBefore,
          bufferAfter: et.bufferAfter,
          minNotice: et.minNotice,
          maxDaysAhead: et.maxDaysAhead,
          slotInterval: et.slotInterval,
          dailyLimit: et.dailyLimit,
          seats: et.seats,
          questions: et.questions,
          hidden: et.hidden,
          active: et.active,
        }}
      />
    </div>
  );
}
