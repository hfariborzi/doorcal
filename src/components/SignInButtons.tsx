import { enabledProviders } from "@/lib/calendar";
import { ProviderButton } from "./ProviderButton";

/** One button per sign-in provider this instance has credentials for. Server component. */
export function SignInButtons() {
  const providers = enabledProviders();
  if (providers.length === 0) return <p className="text-sm text-danger">Sign-in is not configured on this instance.</p>;
  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <ProviderButton key={p} provider={p} />
      ))}
    </div>
  );
}
