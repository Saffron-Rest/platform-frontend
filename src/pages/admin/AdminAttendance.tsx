import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { AttendanceCalendar } from "../AttendanceCalendar";

export function AdminAttendance() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule"
        subtitle="Plan who works which days — these shifts drive the Salaries calculation"
        action={
          <Link
            to="/admin/hours"
            className="text-sm font-medium text-[var(--color-saffron)] whitespace-nowrap"
          >
            Restaurant hours →
          </Link>
        }
      />
      <AttendanceCalendar />
    </div>
  );
}
