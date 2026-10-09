import { requireUser } from "@/lib/auth";
import { isConnected, listAccounts } from "@/lib/calendar";
import { CalendarView } from "./CalendarView";

export const metadata = { title: "Calendar" };

export default async function DashboardHome() {
  const user = await requireUser();
  const connected = (await listAccounts(user.id)).some(isConnected);
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Calendar</h1>
      {connected ? (
        <CalendarView />
      ) : (
        <div className="card p-10 text-center text-faint">Connect a calendar to see your events here.</div>
      )}
    </div>
  );
}
