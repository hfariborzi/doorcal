import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";
import { GoogleButton } from "@/components/GoogleButton";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");

  return (
    <>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="card w-full max-w-sm p-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">◷</span>
            {APP_NAME}
          </Link>
          <h1 className="mt-6 text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use your Google account. You&apos;ll be asked to allow access to your calendar so we can check when you&apos;re
            free and add meetings for you.
          </p>
          {typeof error === "string" && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="mt-6">
            <GoogleButton />
          </div>
          <p className="mt-6 text-xs text-slate-500">
            We only use calendar access for scheduling: reading your free/busy times and your events so you can see them
            here, and creating, updating or cancelling the meetings people book with you. You can revoke access at any
            time from your Google Account.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
