import { enabledProviders } from "@/lib/calendar";
import { ProviderButton } from "./ProviderButton";

/** One button per sign-in provider this instance has credentials for. Server component. */
export function SignInButtons({ row = false, start = false, dark = false }: { row?: boolean; start?: boolean; dark?: boolean }) {
  const providers = enabledProviders();
  if (providers.length === 0) return <p className="text-sm text-danger">Sign-in is not configured on this instance.</p>;
  return (
    <div className={row ? `flex flex-col gap-3 sm:flex-row ${start ? "items-stretch sm:items-center sm:justify-start" : "items-center justify-center"}` : "space-y-3"}>
      {providers.map((p) => (
        <ProviderButton key={p} provider={p} inline={row} dark={dark} />
      ))}
    </div>
  );
}
