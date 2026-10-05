import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSchedules } from "@/lib/data";
import { ScheduleActions } from "./ScheduleActions";

export const metadata = { title: "Availability" };

const SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (h === 24) return "12am";
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export default async function AvailabilityPage() {
  const user = await requireUser();
  const schedules = await listSchedules(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Availability</h1>
          <p className="text-sm text-slate-600">
            Set the hours you take meetings. Create several schedules (e.g. &quot;Office hours&quot;, &quot;Evenings&quot;) and pick one per event type.
          </p>
        </div>
        <Link href="/dashboard/availability/new" className="btn-primary">+ New schedule</Link>
      </div>
      <div className="space-y-3">
        {schedules.map((s) => (
          <div key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/availability/${s.id}`} className="font-semibold hover:text-blue-700">{s.name}</Link>
                {s.isDefault && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Default</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {[1, 2, 3, 4, 5, 6, 7]
                  .filter((d) => (s.weekly[String(d)] ?? []).length > 0)
                  .map((d) => `${SHORT[d]} ${(s.weekly[String(d)] ?? []).map((r) => `${fmt(r.start)}–${fmt(r.end)}`).join(", ")}`)
                  .join(" · ") || "No weekly hours"}
              </p>
              <p className="text-xs text-slate-400">{s.timezone.replace(/_/g, " ")}{s.overrides.length > 0 && ` · ${s.overrides.length} date override${s.overrides.length > 1 ? "s" : ""}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/availability/${s.id}`} className="btn-secondary py-1.5">Edit</Link>
              <ScheduleActions id={s.id} isDefault={s.isDefault} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
