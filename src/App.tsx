import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { Dashboard } from "./pages/Dashboard";
import { EntryPage } from "./pages/EntryPage";
import { EntryDetail } from "./pages/EntryDetail";
import { Reports } from "./pages/Reports";
import { ShiftReports } from "./pages/ShiftReports";
import { ProfitLoss } from "./pages/ProfitLoss";
import { Schedule } from "./pages/Schedule";
import { AdminGuard } from "./components/admin/AdminGuard";
import { OperationsGuard } from "./components/admin/OperationsGuard";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminTeam } from "./pages/admin/AdminTeam";
import { AdminAttendance } from "./pages/admin/AdminAttendance";
import { AdminSalaries } from "./pages/admin/AdminSalaries";
import { AdminPayouts } from "./pages/admin/AdminPayouts";
import { AdminRestaurantHours } from "./pages/admin/AdminRestaurantHours";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminAudit } from "./pages/admin/AdminAudit";
import { AdminTagLibrary } from "./pages/admin/AdminTagLibrary";
import { AdminDataHealth } from "./pages/admin/AdminDataHealth";
import { AdminMenu } from "./pages/admin/AdminMenu";
import { AdminPos } from "./pages/admin/AdminPos";
import { MenuAnalytics } from "./pages/MenuAnalytics";
import { MenuEngineering } from "./pages/MenuEngineering";
import { FinanceLedger } from "./pages/FinanceLedger";
import { TreasuryHistory } from "./pages/TreasuryHistory";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entry" element={<EntryPage />} />
            <Route path="/entry/:id" element={<EntryDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route element={<OperationsGuard />}>
              <Route path="/reports" element={<ShiftReports />} />
              <Route path="/analytics" element={<Reports />} />
              <Route path="/profit-loss" element={<ProfitLoss />} />
              <Route path="/history" element={<Navigate to="/reports" replace />} />
              <Route path="/audit" element={<AdminAudit />} />
              <Route path="/finance" element={<FinanceLedger />} />
              <Route path="/treasury/history" element={<TreasuryHistory />} />
              <Route path="/menu" element={<MenuAnalytics />} />
              <Route path="/menu/engineering" element={<MenuEngineering />} />
            </Route>
            <Route path="/admin" element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="team" replace />} />
                <Route path="team" element={<AdminTeam />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route path="salaries" element={<AdminSalaries />} />
                <Route path="payouts" element={<AdminPayouts />} />
                <Route path="hours" element={<AdminRestaurantHours />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="tags" element={<AdminTagLibrary />} />
                <Route path="inbox" element={<AdminDataHealth />} />
                <Route path="menu" element={<AdminMenu />} />
                <Route path="pos" element={<AdminPos />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
