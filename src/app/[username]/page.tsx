import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getUserByUsername, listEventTypes } from "@/lib/data";
import { locationIcon, locationLabel } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";
import { APP_NAME } from "@/lib/config";

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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center border-b border-slate-200 px-6 py-10 text-center">
          <Avatar name={user.name || user.username} image={user.image} size={72} />
          <h1 className="mt-4 text-2xl font-semibold">{user.name || user.username}</h1>
          {user.headline && <p className="mt-1 text-slate-600">{user.headline}</p>}
          {user.welcome && <p className="mt-4 max-w-xl whitespace-pre-line text-sm text-slate-600">{user.welcome}</p>}
        </div>
        {types.length === 0 ? (
          <p className="p-10 text-center text-slate-500">No events are available to book right now.</p>
        ) : (
          <ul className="grid gap-px bg-slate-200 sm:grid-cols-2">
            {types.map((t) => (
              <li key={t.id} className="bg-white">
                <Link
                  href={`/${user.username}/${t.slug}`}
                  className="group flex h-full flex-col gap-2 p-6 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    <h2 className="font-semibold group-hover:text-blue-700">{t.title}</h2>
                  </div>
                  <p className="text-sm text-slate-500">
                    {t.durations.map((d) => `${d} min`).join(" / ")}
                    {t.seats > 1 && ` · Group (${t.seats} seats)`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t.locations.map((l) => `${locationIcon(l.type)} ${locationLabel(l)}`).join("  ·  ")}
                  </p>
                  {t.description && <p className="line-clamp-2 text-sm text-slate-600">{t.description}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">
        Powered by <Link href="/" className="hover:underline">{APP_NAME}</Link>
      </p>
    </main>
  );
}
