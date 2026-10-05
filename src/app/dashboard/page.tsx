import { requireUser } from "@/lib/auth";
import { CalendarView } from "./CalendarView";

export const metadata = { title: "Calendar" };

export default async function DashboardHome() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-slate-600">
          Your Google Calendar. Click any open time to create a meeting.
        </p>
      </div>
      {user.googleRefreshToken ? (
        <CalendarView />
      ) : (
        <div className="card p-10 text-center text-slate-500">Connect Google Calendar to see your events here.</div>
      )}
    </div>
  );
}
