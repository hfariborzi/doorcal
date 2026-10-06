import { AI_PROVIDER_NAME, aiConfigured, usageThisMonth } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { calendarsForAccounts, enabledProviders, listAccounts } from "@/lib/calendar";
import { ensureCategories, listRules } from "@/lib/labels";
import { AiSettings } from "./AiSettings";
import { CategoriesSettings } from "./CategoriesSettings";
import { ConnectedCalendars, DangerZone, ProfileForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/dashboard/settings">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const accounts = await listAccounts(user.id);
  const groups = await calendarsForAccounts(accounts);
  const [cats, rules, usage] = await Promise.all([ensureCategories(user.id), listRules(user.id), aiConfigured() ? usageThisMonth(user.id) : { events: 0, requests: 0 }]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <ProfileForm
        initial={{ name: user.name, username: user.username, headline: user.headline, welcome: user.welcome, timezone: user.timezone }}
      />
      <ConnectedCalendars
        providers={enabledProviders()}
        accounts={groups.map(({ account, calendars, error }) => ({
          id: account.id,
          provider: account.provider,
          email: account.email,
          connected: !!account.refreshToken,
          onlineMeetings: account.onlineMeetings,
          conflictCalendarIds: account.conflictCalendarIds,
          calendars,
          error,
        }))}
        initialWrite={{ accountId: user.writeAccountId, calendarId: user.writeCalendarId }}
        flash={typeof sp.error === "string" ? { kind: "error", text: sp.error } : sp.connected === "1" ? { kind: "ok", text: "Calendar connected." } : null}
      />
      <CategoriesSettings categories={cats} rules={rules} />
      <AiSettings configured={aiConfigured()} providerName={AI_PROVIDER_NAME} enabled={!!user.aiConsentAt} usage={usage} hasCategories={cats.length > 0} />
      <DangerZone />
    </div>
  );
}
