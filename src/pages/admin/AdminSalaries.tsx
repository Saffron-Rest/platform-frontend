import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { SalariesPanel } from "../SalariesPanel";

export function AdminSalaries() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Salaries"
        subtitle="Monthly payroll from attendance and pay settings"
        action={
          <Link
            to="/admin/team"
            className="text-sm font-medium text-[var(--color-saffron)] mr-2"
          >
            Team →
          </Link>
        }
      />
      <SalariesPanel />
    </div>
  );
}
