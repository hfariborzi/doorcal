import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schedules } from "@/db";
import { requireUser } from "@/lib/auth";
import { DEFAULT_WEEKLY } from "@/lib/availability";
import { ScheduleForm } from "../ScheduleForm";

export const metadata = { title: "Edit schedule" };

export default async function SchedulePage(props: PageProps<"/dashboard/availability/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  let initial;
  if (id === "new") {
    initial = { name: "New schedule", timezone: user.timezone, weekly: DEFAULT_WEEKLY, overrides: [] };
  } else {
    const [s] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, Number(id) || 0), eq(schedules.userId, user.id)));
    if (!s) notFound();
    initial = { id: s.id, name: s.name, timezone: s.timezone, weekly: s.weekly, overrides: s.overrides };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/availability" className="text-sm text-faint hover:text-ink">← Availability</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{initial.name}</h1>
      <ScheduleForm key={id} initial={initial} />
    </div>
  );
}
