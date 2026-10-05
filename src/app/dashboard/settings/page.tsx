import { requireUser } from "@/lib/auth";
import { listCalendars, type CalendarListItem } from "@/lib/google";
import { GoogleButton } from "@/components/GoogleButton";
import { CalendarsForm, DangerZone, ProfileForm } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  let calendars: CalendarListItem[] = [];
  let calendarError: string | null = null;
  if (user.googleRefreshToken) {
    try {
      calendars = await listCalendars(user);
    } catch (err) {
      calendarError = (err as Error).message;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <ProfileForm
        initial={{ name: user.name, username: user.username, headline: user.headline, welcome: user.welcome, timezone: user.timezone }}
      />

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">Google account</h2>
        <p className="text-sm text-muted">
          Signed in as <strong>{user.email}</strong>.{" "}
          {user.googleRefreshToken ? "Google Calendar is connected." : "Google Calendar is not connected."}
        </p>
        <div className="w-72">
          <GoogleButton reconnect label={user.googleRefreshToken ? "Reconnect Google Calendar" : "Connect Google Calendar"} />
        </div>
        {calendarError && <p className="text-sm text-danger">Couldn&apos;t load your calendars: {calendarError}</p>}
      </section>

      {calendars.length > 0 && (
        <CalendarsForm
          calendars={calendars}
          initial={{ writeCalendarId: user.writeCalendarId, conflictCalendarIds: user.conflictCalendarIds }}
        />
      )}

      <DangerZone connected={!!user.googleRefreshToken} />
    </div>
  );
}
