import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { PLATFORM_LABEL, parsePlatform } from "@/lib/native";
import { Logo } from "@/components/Logo";
import { SignInButtons } from "@/components/SignInButtons";

export const metadata = { title: "Connect the app" };

/**
 * Where a desktop or phone app sends the browser to link itself to a Midore account. Signed out: sign in first and
 * come back here. Signed in: one button that hands a one-time code back to the app.
 */
export default async function ConnectApp(props: PageProps<"/native/connect">) {
  const sp = await props.searchParams;
  const platform = parsePlatform(sp.platform);
  const state = typeof sp.state === "string" && /^[\w-]{8,64}$/.test(sp.state) ? sp.state : null;
  const name = typeof sp.name === "string" ? sp.name.slice(0, 80) : "";
  const user = await getCurrentUser().catch(() => null);

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-[100dvh] flex-col items-center px-6 pt-14 pb-16">
      <Logo />
      <div className="my-auto w-full max-w-sm py-16 text-center">{children}</div>
    </main>
  );

  if (!platform || !state) {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight">This link is incomplete</h1>
        <p className="mt-3 text-sm text-muted">Open the {APP_NAME} app and choose Sign in again.</p>
      </>,
    );
  }

  const here = `/native/connect?${new URLSearchParams({ platform, state, ...(name ? { name } : {}) })}`;
  const label = `${APP_NAME} for ${PLATFORM_LABEL[platform]}`;

  if (!user) {
    return shell(
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to {label}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">Sign in with the account you use for {APP_NAME}. You come back to the app afterwards.</p>
        <div className="mt-8">
          <SignInButtons next={here} />
        </div>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Connect {label}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Signed in as <span className="font-medium text-ink">{user.email}</span>. The app will show your calendar, tasks and plan, and its widgets can
        mark tasks done. You can disconnect it any time in Settings.
      </p>
      <form action="/api/native/connect" method="post" className="mt-8 space-y-3">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="name" value={name} />
        <button className="btn-primary h-11 w-full text-base">Connect and open the app</button>
      </form>
      <form action="/api/auth/logout" method="post" className="mt-3">
        <button className="btn-ghost w-full text-sm">
          <LogOut size={15} /> Use a different account
        </button>
      </form>
    </>,
  );
}
