import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GoogleButton } from "@/components/GoogleButton";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");

  return (
    <>
      <main className="flex flex-1 flex-col items-center px-6 pt-14 pb-16">
        <Logo />
        <div className="my-auto w-full max-w-sm py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Use your Google account. Google will ask you to allow calendar access so we can see when you&apos;re free
            and add the meetings people book.
          </p>
          {typeof error === "string" && (
            <p className="mt-6 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}
          <div className="mt-8">
            <GoogleButton />
          </div>
          <p className="mt-8 text-xs leading-relaxed text-faint">
            You can disconnect or delete your account at any time. Read the{" "}
            <Link href="/privacy" className="link">privacy policy</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
