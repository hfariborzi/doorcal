import { requireUser } from "@/lib/auth";
import { isConnected, listAccounts } from "@/lib/calendar";
import { CalendarView } from "./CalendarView";

export const metadata = { title: "Calendar" };

export default async function DashboardHome() {
  const user = await requireUser();
  const connected = (await listAccounts(user.id)).some(isConnected);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted">
          Your connected calendars. Click any open time to create a meeting.
        </p>
      </div>
      {connected ? (
        <CalendarView />
      ) : (
        <div className="card p-10 text-center text-faint">Connect a calendar to see your events here.</div>
      )}
    </div>
  );
}
