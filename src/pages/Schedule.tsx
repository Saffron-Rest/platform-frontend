import { useAuth } from "../context/AuthContext";
import { canOperate } from "../lib/roles";
import { PageHeader } from "../components/ui/PageHeader";
import { AttendanceCalendar } from "./AttendanceCalendar";

export function Schedule() {
  const { user } = useAuth();
  const editable = canOperate(user?.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title={editable ? "Attendance" : "Schedule"}
        subtitle={
          editable
            ? "Calendar by day or cashier — tap a day to schedule staff"
            : user
              ? `Team shifts for the month — your rows are highlighted (${user.name})`
              : "Team shifts for the month"
        }
      />
      <div data-tour="tour-schedule-calendar">
        <AttendanceCalendar readOnly={!editable} />
      </div>
    </div>
  );
}
