import { appleEnabled } from "@/lib/apple";
import { enabledProviders } from "@/lib/calendar";
import { AppleButton } from "./AppleButton";
import { ProviderButton } from "./ProviderButton";

/** One button per sign-in provider this instance has credentials for (Google, Microsoft, Apple). Server component. */
export function SignInButtons({ row = false, start = false, dark = false, next }: { row?: boolean; start?: boolean; dark?: boolean; next?: string }) {
  const providers = enabledProviders();
  const apple = appleEnabled();
  if (providers.length === 0 && !apple) return <p className="text-sm text-danger">Sign-in is not configured on this instance.</p>;
  return (
    <div className={row ? `flex flex-col gap-3 sm:flex-row ${start ? "items-stretch sm:items-center sm:justify-start" : "items-center justify-center"}` : "space-y-3"}>
      {providers.map((p) => (
        <ProviderButton key={p} provider={p} inline={row} dark={dark} next={next} />
      ))}
      {apple && <AppleButton inline={row} dark={dark} next={next} />}
    </div>
  );
}
