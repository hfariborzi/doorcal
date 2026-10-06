import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, Clock, Users } from "lucide-react";
import { getUserByUsername, listEventTypes } from "@/lib/data";
import { locationLabel } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";
import { LocationIcon } from "@/components/LocationIcon";
import { PoweredBy } from "@/components/PoweredBy";

export async function generateMetadata(props: PageProps<"/[username]">) {
  const { username } = await props.params;
  const user = await getUserByUsername(username);
  return { title: user ? user.name || user.username : "Not found" };
}

export default async function ProfilePage(props: PageProps<"/[username]">) {
  await connection();
  const { username } = await props.params;
  const user = await getUserByUsername(username);
  if (!user) notFound();
  const types = (await listEventTypes(user.id)).filter((t) => t.active && !t.hidden);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <Avatar name={user.name || user.username} image={user.image} size={80} />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">{user.name || user.username}</h1>
        {user.headline && <p className="mt-2 text-muted">{user.headline}</p>}
        {user.welcome && <p className="mt-5 max-w-lg text-sm leading-relaxed whitespace-pre-line text-muted">{user.welcome}</p>}
      </div>

      {types.length === 0 ? (
        <p className="mt-14 text-center text-faint">No events are available to book right now.</p>
      ) : (
        <ul className="mt-12 divide-y divide-line border-y border-line">
          {types.map((t) => (
            <li key={t.id}>
              <Link href={`/${user.username}/${t.slug}`} className="group flex items-center gap-4 px-2 py-5 transition hover:bg-paper">
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: t.color }} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-ink">{t.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
                    <span className="inline-flex items-center gap-1.5 tnum">
                      <Clock size={14} strokeWidth={1.75} />
                      {t.durations.map((d) => `${d} min`).join(" / ")}
                    </span>
                    {t.locations.map((l, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        <LocationIcon type={l.type} size={14} />
                        {locationLabel(l)}
                      </span>
                    ))}
                    {t.seats > 1 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={14} strokeWidth={1.75} />
                        Group
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent-soft" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PoweredBy />
    </main>
  );
}
