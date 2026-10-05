import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEventTypes } from "@/lib/data";
import { requestBaseUrl } from "@/lib/origin";
import { locationIcon, locationLabel } from "@/lib/locations";
import { CopyButton } from "@/components/CopyButton";
import { EventTypeActions } from "./EventTypeActions";

export const metadata = { title: "Event types" };

export default async function EventTypesPage() {
  const user = await requireUser();
  const types = await listEventTypes(user.id);
  const base = await requestBaseUrl();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Event types</h1>
          <p className="text-sm text-slate-600">The kinds of meetings people can book with you.</p>
        </div>
        <Link href="/dashboard/event-types/new" className="btn-primary">+ New event type</Link>
      </div>

      {types.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No event types yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {types.map((t) => {
            const url = `${base}/${user.username}/${t.slug}`;
            return (
              <div key={t.id} className={`card overflow-hidden ${t.active ? "" : "opacity-60"}`}>
                <div className="h-1.5" style={{ background: t.color }} />
                <div className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/event-types/${t.id}`} className="font-semibold hover:text-blue-700">
                      {t.title}
                    </Link>
                    <div className="flex gap-1">
                      {t.hidden && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Secret</span>}
                      {t.seats > 1 && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">Group · {t.seats}</span>}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    {t.durations.map((d) => `${d} min`).join(" / ")} ·{" "}
                    {t.locations.map((l) => `${locationIcon(l.type)} ${locationLabel(l)}`).join(", ")}
                  </p>
                  <p className="truncate text-xs text-slate-400">/{user.username}/{t.slug}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
                  <div className="flex gap-2">
                    <CopyButton text={url} className="btn-secondary py-1.5" />
                    <Link href={`/dashboard/event-types/${t.id}`} className="btn-secondary py-1.5">Edit</Link>
                    <a href={url} target="_blank" rel="noreferrer" className="btn-ghost py-1.5">View</a>
                  </div>
                  <EventTypeActions id={t.id} active={t.active} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
