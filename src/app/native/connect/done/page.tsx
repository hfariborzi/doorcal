import { APP_NAME } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { OpenApp } from "./OpenApp";

export const metadata = { title: "Opening the app" };

/** After connecting: hand the one-time link to the app, with a button in case the browser asks first. */
export default async function Done(props: PageProps<"/native/connect/done">) {
  const { link } = await props.searchParams;
  const ok = typeof link === "string" && /^midore:\/\/auth\?code=[\w-]+&state=[\w-]+$/.test(link);
  return (
    <main className="flex min-h-[100dvh] flex-col items-center px-6 pt-14 pb-16">
      <Logo />
      <div className="my-auto w-full max-w-sm py-16 text-center">
        {ok ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Opening {APP_NAME}…</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">If your browser asks, allow it to open {APP_NAME}. This link works once, for five minutes.</p>
            <OpenApp href={link} />
            <p className="mt-6 text-xs text-faint">You can close this tab afterwards.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">This link has expired</h1>
            <p className="mt-3 text-sm text-muted">Open the {APP_NAME} app and choose Sign in again.</p>
          </>
        )}
      </div>
    </main>
  );
}
