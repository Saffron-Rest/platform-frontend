import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { Toaster } from "./components/ui/Toaster";
import { ScrollToTop } from "./components/ScrollToTop";
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
import { RequirePermission } from "./components/admin/RequirePermission";
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
import { AdminRecipes } from "./pages/admin/AdminRecipes";
import { AdminPos } from "./pages/admin/AdminPos";
import { AdminPosSimulator } from "./pages/admin/AdminPosSimulator";
import { AdminPayables } from "./pages/admin/AdminPayables";
import { AdminStock } from "./pages/admin/AdminStock";
import { AdminIncidents } from "./pages/admin/AdminIncidents";
import { AdminCertifications } from "./pages/admin/AdminCertifications";
import { AdminChecklists } from "./pages/admin/AdminChecklists";
import { DailyChecklists } from "./pages/DailyChecklists";
import { HaccpLogs } from "./pages/HaccpLogs";
import { AdminSecurity } from "./pages/admin/AdminSecurity";
import { MenuAnalytics } from "./pages/MenuAnalytics";
import { MenuEngineering } from "./pages/MenuEngineering";
import { FinanceLedger } from "./pages/FinanceLedger";
import { TreasuryHistory } from "./pages/TreasuryHistory";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Toaster />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/entry" element={<EntryPage />} />
              <Route path="/entry/:id" element={<EntryDetail />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/checklists" element={<DailyChecklists />} />
              <Route path="/haccp" element={<HaccpLogs />} />
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
              {/*
                  Admin routes are no longer blanket-gated by role —
                  each page declares the permissions that grant entry,
                  so an admin can delegate any operational page to a
                  manager (or even a cashier) by toggling a permission
                  in "Manage permissions". Admins always pass thanks to
                  the isAdmin shortcut inside RequirePermission.

                  Strictly-admin routes stay under <AdminGuard>.
              */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="team" replace />} />
                <Route element={<RequirePermission anyOf={["TEAM_VIEW", "TEAM_MANAGE"]} />}>
                  <Route path="team" element={<AdminTeam />} />
                </Route>
                <Route element={<RequirePermission anyOf={["ATTENDANCE_VIEW", "SCHEDULE_MANAGE", "SCHEDULE_BULK"]} />}>
                  <Route path="attendance" element={<AdminAttendance />} />
                </Route>
                <Route element={<RequirePermission anyOf={["SALARIES_VIEW", "SALARIES_MANAGE", "PAY_RATES_MANAGE"]} />}>
                  <Route path="salaries" element={<AdminSalaries />} />
                  <Route path="payouts" element={<AdminPayouts />} />
                </Route>
                <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE"]} />}>
                  <Route path="hours" element={<AdminRestaurantHours />} />
                </Route>
                <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE", "TREASURY_VIEW", "TREASURY_MANAGE"]} />}>
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
                <Route element={<RequirePermission anyOf={["TAGS_MANAGE"]} />}>
                  <Route path="tags" element={<AdminTagLibrary />} />
                </Route>
                <Route element={<RequirePermission anyOf={["REPORTS_VIEW"]} />}>
                  <Route path="inbox" element={<AdminDataHealth />} />
                </Route>
                <Route element={<RequirePermission anyOf={["MENU_VIEW", "MENU_MANAGE"]} />}>
                  <Route path="menu" element={<AdminMenu />} />
                </Route>
                <Route element={<RequirePermission anyOf={["MENU_VIEW", "MENU_RECIPES_MANAGE"]} />}>
                  <Route path="recipes" element={<AdminRecipes />} />
                </Route>
                <Route element={<RequirePermission anyOf={["STOCK_VIEW", "STOCK_ADJUST", "STOCK_MANAGE", "STOCK_DELETE"]} />}>
                  <Route path="stock" element={<AdminStock />} />
                </Route>
                <Route element={<RequirePermission anyOf={["INCIDENTS_VIEW", "INCIDENTS_FILE", "INCIDENTS_RESOLVE"]} />}>
                  <Route path="incidents" element={<AdminIncidents />} />
                </Route>
                <Route element={<RequirePermission anyOf={["CERTIFICATIONS_VIEW", "CERTIFICATIONS_MANAGE"]} />}>
                  <Route path="certifications" element={<AdminCertifications />} />
                </Route>
                <Route element={<RequirePermission anyOf={["CHECKLISTS_RUN", "CHECKLISTS_CONFIGURE"]} />}>
                  <Route path="checklists" element={<AdminChecklists />} />
                </Route>
                <Route element={<RequirePermission anyOf={["HACCP_LOG", "HACCP_EXPORT", "HACCP_CONFIGURE"]} />}>
                  <Route path="haccp" element={<HaccpLogs />} />
                </Route>
                <Route element={<RequirePermission anyOf={["POS_INTEGRATION_VIEW", "POS_INTEGRATION_MANAGE"]} />}>
                  <Route path="pos" element={<AdminPos />} />
                </Route>
                <Route element={<RequirePermission anyOf={["POS_INTEGRATION_MANAGE"]} />}>
                  <Route path="pos/simulator" element={<AdminPosSimulator />} />
                </Route>
                <Route element={<RequirePermission anyOf={["PAYABLES_VIEW", "PAYABLES_MANAGE"]} />}>
                  <Route path="payables" element={<AdminPayables />} />
                </Route>
                {/* Strictly admin: 2FA / session management. */}
                <Route element={<AdminGuard />}>
                  <Route path="security" element={<AdminSecurity />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
