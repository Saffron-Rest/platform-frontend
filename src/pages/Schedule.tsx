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
        title="Schedule"
        subtitle={
          editable
            ? "Plan who works which days — these shifts drive Salaries"
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
