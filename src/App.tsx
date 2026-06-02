import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { Toaster } from "./components/ui/Toaster";
import { ScrollToTop } from "./components/ScrollToTop";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { Spinner } from "./components/ui/Spinner";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { NoAccess } from "./pages/NoAccess";
import { Dashboard } from "./pages/Dashboard";
import { EntryPage } from "./pages/EntryPage";
import { EntryDetail } from "./pages/EntryDetail";
import { Schedule } from "./pages/Schedule";
import { DailyChecklists } from "./pages/DailyChecklists";
import { HaccpLogs } from "./pages/HaccpLogs";
import { AdminGuard } from "./components/admin/AdminGuard";
import { OperationsGuard } from "./components/admin/OperationsGuard";
import { RequirePermission } from "./components/admin/RequirePermission";
import { AdminLayout } from "./components/admin/AdminLayout";

/* ── Operations + finance pages (used by manager+) lazy-load so the
   cashier login bundle stays slim. Each section is a separate chunk. */
const Reports = lazy(() => import("./pages/Reports").then((m) => ({ default: m.Reports })));
const ShiftReports = lazy(() => import("./pages/ShiftReports").then((m) => ({ default: m.ShiftReports })));
const ProfitLoss = lazy(() => import("./pages/ProfitLoss").then((m) => ({ default: m.ProfitLoss })));
const FinanceLedger = lazy(() => import("./pages/FinanceLedger").then((m) => ({ default: m.FinanceLedger })));
const TreasuryHistory = lazy(() => import("./pages/TreasuryHistory").then((m) => ({ default: m.TreasuryHistory })));
const MenuAnalytics = lazy(() => import("./pages/MenuAnalytics").then((m) => ({ default: m.MenuAnalytics })));
const MenuEngineering = lazy(() => import("./pages/MenuEngineering").then((m) => ({ default: m.MenuEngineering })));

/* ── Admin pages — heaviest in the codebase, always lazy. ── */
const AdminTeam = lazy(() => import("./pages/admin/AdminTeam").then((m) => ({ default: m.AdminTeam })));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance").then((m) => ({ default: m.AdminAttendance })));
const AdminSalaries = lazy(() => import("./pages/admin/AdminSalaries").then((m) => ({ default: m.AdminSalaries })));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts").then((m) => ({ default: m.AdminPayouts })));
const AdminRestaurantHours = lazy(() => import("./pages/admin/AdminRestaurantHours").then((m) => ({ default: m.AdminRestaurantHours })));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings").then((m) => ({ default: m.AdminSettings })));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit").then((m) => ({ default: m.AdminAudit })));
const AdminTagLibrary = lazy(() => import("./pages/admin/AdminTagLibrary").then((m) => ({ default: m.AdminTagLibrary })));
const AdminDataHealth = lazy(() => import("./pages/admin/AdminDataHealth").then((m) => ({ default: m.AdminDataHealth })));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu").then((m) => ({ default: m.AdminMenu })));
const AdminRecipes = lazy(() => import("./pages/admin/AdminRecipes").then((m) => ({ default: m.AdminRecipes })));
const AdminPos = lazy(() => import("./pages/admin/AdminPos").then((m) => ({ default: m.AdminPos })));
const AdminPosSimulator = lazy(() => import("./pages/admin/AdminPosSimulator").then((m) => ({ default: m.AdminPosSimulator })));
const AdminPayables = lazy(() => import("./pages/admin/AdminPayables").then((m) => ({ default: m.AdminPayables })));
const AdminOwnerExpenses = lazy(() => import("./pages/admin/AdminOwnerExpenses").then((m) => ({ default: m.AdminOwnerExpenses })));
const AdminStock = lazy(() => import("./pages/admin/AdminStock").then((m) => ({ default: m.AdminStock })));
const AdminIncidents = lazy(() => import("./pages/admin/AdminIncidents").then((m) => ({ default: m.AdminIncidents })));
const AdminCertifications = lazy(() => import("./pages/admin/AdminCertifications").then((m) => ({ default: m.AdminCertifications })));
const AdminChecklists = lazy(() => import("./pages/admin/AdminChecklists").then((m) => ({ default: m.AdminChecklists })));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity").then((m) => ({ default: m.AdminSecurity })));

/** Suspense fallback used while a lazy chunk loads. Matches the rest of
 *  the app's spinner styling so the in-flight transition feels native. */
function ChunkFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner label="Loading…" />
    </div>
  );
}

/** Wraps each lazy route in its own Suspense + per-route ErrorBoundary
 *  so a chunk-load failure or a render bug only takes down that one
 *  page, not the whole shell. */
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<ChunkFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary scope="root">
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Toaster />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route element={<Layout />}>
                  <Route path="/no-access" element={<NoAccess />} />
                  <Route path="/" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
                  <Route path="/entry" element={<RouteErrorBoundary><EntryPage /></RouteErrorBoundary>} />
                  <Route path="/entry/:id" element={<RouteErrorBoundary><EntryDetail /></RouteErrorBoundary>} />
                  <Route path="/schedule" element={<RouteErrorBoundary><Schedule /></RouteErrorBoundary>} />
                  <Route path="/checklists" element={<RouteErrorBoundary><DailyChecklists /></RouteErrorBoundary>} />
                  <Route path="/haccp" element={<RouteErrorBoundary><HaccpLogs /></RouteErrorBoundary>} />
                  <Route element={<OperationsGuard />}>
                    <Route path="/reports" element={<LazyRoute><ShiftReports /></LazyRoute>} />
                    <Route path="/analytics" element={<LazyRoute><Reports /></LazyRoute>} />
                    <Route path="/profit-loss" element={<LazyRoute><ProfitLoss /></LazyRoute>} />
                    <Route path="/history" element={<Navigate to="/reports" replace />} />
                    <Route path="/audit" element={<LazyRoute><AdminAudit /></LazyRoute>} />
                    <Route path="/finance" element={<LazyRoute><FinanceLedger /></LazyRoute>} />
                    <Route path="/treasury/history" element={<LazyRoute><TreasuryHistory /></LazyRoute>} />
                    <Route path="/menu" element={<LazyRoute><MenuAnalytics /></LazyRoute>} />
                    <Route path="/menu/engineering" element={<LazyRoute><MenuEngineering /></LazyRoute>} />
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
                      <Route path="team" element={<LazyRoute><AdminTeam /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["ATTENDANCE_VIEW", "SCHEDULE_MANAGE", "SCHEDULE_BULK"]} />}>
                      <Route path="attendance" element={<LazyRoute><AdminAttendance /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["SALARIES_VIEW", "SALARIES_MANAGE", "PAY_RATES_MANAGE"]} />}>
                      <Route path="salaries" element={<LazyRoute><AdminSalaries /></LazyRoute>} />
                      <Route path="payouts" element={<LazyRoute><AdminPayouts /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE"]} />}>
                      <Route path="hours" element={<LazyRoute><AdminRestaurantHours /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE", "TREASURY_VIEW", "TREASURY_MANAGE"]} />}>
                      <Route path="settings" element={<LazyRoute><AdminSettings /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["TAGS_MANAGE"]} />}>
                      <Route path="tags" element={<LazyRoute><AdminTagLibrary /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["REPORTS_VIEW"]} />}>
                      <Route path="inbox" element={<LazyRoute><AdminDataHealth /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["MENU_VIEW", "MENU_MANAGE"]} />}>
                      <Route path="menu" element={<LazyRoute><AdminMenu /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["MENU_VIEW", "MENU_RECIPES_MANAGE"]} />}>
                      <Route path="recipes" element={<LazyRoute><AdminRecipes /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["STOCK_VIEW", "STOCK_ADJUST", "STOCK_MANAGE", "STOCK_DELETE"]} />}>
                      <Route path="stock" element={<LazyRoute><AdminStock /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["INCIDENTS_VIEW", "INCIDENTS_FILE", "INCIDENTS_RESOLVE"]} />}>
                      <Route path="incidents" element={<LazyRoute><AdminIncidents /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["CERTIFICATIONS_VIEW", "CERTIFICATIONS_MANAGE"]} />}>
                      <Route path="certifications" element={<LazyRoute><AdminCertifications /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["CHECKLISTS_RUN", "CHECKLISTS_CONFIGURE"]} />}>
                      <Route path="checklists" element={<LazyRoute><AdminChecklists /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["HACCP_LOG", "HACCP_EXPORT", "HACCP_CONFIGURE"]} />}>
                      <Route path="haccp" element={<RouteErrorBoundary><HaccpLogs /></RouteErrorBoundary>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["POS_INTEGRATION_VIEW", "POS_INTEGRATION_MANAGE"]} />}>
                      <Route path="pos" element={<LazyRoute><AdminPos /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["POS_INTEGRATION_MANAGE"]} />}>
                      <Route path="pos/simulator" element={<LazyRoute><AdminPosSimulator /></LazyRoute>} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["PAYABLES_VIEW", "PAYABLES_MANAGE"]} />}>
                      <Route path="payables" element={<LazyRoute><AdminPayables /></LazyRoute>} />
                    </Route>
                    <Route
                      element={
                        <RequirePermission
                          anyOf={[
                            "OWNER_EXPENSES_VIEW",
                            "OWNER_EXPENSES_MANAGE",
                            "OWNER_EXPENSES_FILE",
                          ]}
                        />
                      }
                    >
                      <Route path="owner-expenses" element={<LazyRoute><AdminOwnerExpenses /></LazyRoute>} />
                    </Route>
                    {/* Strictly admin: 2FA / session management. */}
                    <Route element={<AdminGuard />}>
                      <Route path="security" element={<LazyRoute><AdminSecurity /></LazyRoute>} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
