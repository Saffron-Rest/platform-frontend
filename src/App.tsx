import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
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
const ReportsFinance = lazy(() => import("./pages/ReportsFinance").then((m) => ({ default: m.ReportsFinance })));
const MenuAnalytics = lazy(() => import("./pages/MenuAnalytics").then((m) => ({ default: m.MenuAnalytics })));
const MenuEngineering = lazy(() => import("./pages/MenuEngineering").then((m) => ({ default: m.MenuEngineering })));

/* ── Admin pages — heaviest in the codebase, always lazy. ── */
const AdminPeople = lazy(() => import("./pages/admin/AdminPeople").then((m) => ({ default: m.AdminPeople })));
const AdminSettingsHub = lazy(() => import("./pages/admin/AdminSettingsHub").then((m) => ({ default: m.AdminSettingsHub })));
const AdminDataHealth = lazy(() => import("./pages/admin/AdminDataHealth").then((m) => ({ default: m.AdminDataHealth })));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu").then((m) => ({ default: m.AdminMenu })));
const AdminRecipes = lazy(() => import("./pages/admin/AdminRecipes").then((m) => ({ default: m.AdminRecipes })));
const AdminStock = lazy(() => import("./pages/admin/AdminStock").then((m) => ({ default: m.AdminStock })));
const AdminIncidents = lazy(() => import("./pages/admin/AdminIncidents").then((m) => ({ default: m.AdminIncidents })));
const AdminChecklists = lazy(() => import("./pages/admin/AdminChecklists").then((m) => ({ default: m.AdminChecklists })));

/** Suspense fallback used while a lazy chunk loads. Matches the rest of
 *  the app's spinner styling so the in-flight transition feels native. */
function ChunkFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner label="Loading…" />
    </div>
  );
}

/** Preserves the `add` search param when redirecting old /finance URLs
 *  to the new unified /reports?tab=expenses page. */
function FinanceRedirect() {
  const [searchParams] = useSearchParams();
  const add = searchParams.get("add");
  const to = add ? `/reports?tab=expenses&add=${add}` : "/reports?tab=expenses";
  return <Navigate to={to} replace />;
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
                    <Route path="/reports" element={<LazyRoute><ReportsFinance /></LazyRoute>} />
                    <Route path="/analytics" element={<Navigate to="/reports?tab=export" replace />} />
                    <Route path="/profit-loss" element={<Navigate to="/reports?tab=pl" replace />} />
                    <Route path="/history" element={<Navigate to="/reports" replace />} />
                    <Route path="/audit" element={<Navigate to="/admin/settings?tab=audit" replace />} />
                    <Route path="/finance" element={<FinanceRedirect />} />
                    <Route path="/treasury/history" element={<Navigate to="/reports?tab=treasury" replace />} />
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
                    <Route index element={<Navigate to="people" replace />} />
                    {/* Unified people & payroll page */}
                    <Route element={<RequirePermission anyOf={["TEAM_VIEW", "TEAM_MANAGE", "SALARIES_VIEW", "SALARIES_MANAGE", "PAY_RATES_MANAGE", "CERTIFICATIONS_VIEW", "CERTIFICATIONS_MANAGE"]} />}>
                      <Route path="people" element={<LazyRoute><AdminPeople /></LazyRoute>} />
                    </Route>
                    {/* Legacy redirects — preserve old bookmarks/links */}
                    <Route element={<RequirePermission anyOf={["TEAM_VIEW", "TEAM_MANAGE"]} />}>
                      <Route path="team" element={<Navigate to="/admin/people" replace />} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["SALARIES_VIEW", "SALARIES_MANAGE", "PAY_RATES_MANAGE"]} />}>
                      <Route path="salaries" element={<Navigate to="/admin/people?tab=payroll" replace />} />
                      <Route path="payouts" element={<Navigate to="/admin/people?tab=payouts" replace />} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["CERTIFICATIONS_VIEW", "CERTIFICATIONS_MANAGE"]} />}>
                      <Route path="certifications" element={<Navigate to="/admin/people?tab=certifications" replace />} />
                    </Route>
                    <Route path="attendance" element={<Navigate to="/schedule" replace />} />
                    {/* Unified settings hub */}
                    <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE", "TREASURY_VIEW", "TREASURY_MANAGE", "TAGS_MANAGE", "POS_INTEGRATION_VIEW", "POS_INTEGRATION_MANAGE"]} />}>
                      <Route path="settings" element={<LazyRoute><AdminSettingsHub /></LazyRoute>} />
                    </Route>
                    {/* Legacy redirects — preserve old bookmarks/links */}
                    <Route element={<RequirePermission anyOf={["SETTINGS_VIEW", "SETTINGS_MANAGE"]} />}>
                      <Route path="hours" element={<Navigate to="/admin/settings?tab=hours" replace />} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["TAGS_MANAGE"]} />}>
                      <Route path="tags" element={<Navigate to="/admin/settings?tab=tags" replace />} />
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
                    <Route element={<RequirePermission anyOf={["CHECKLISTS_RUN", "CHECKLISTS_CONFIGURE"]} />}>
                      <Route path="checklists" element={<LazyRoute><AdminChecklists /></LazyRoute>} />
                    </Route>
                    <Route path="haccp" element={<Navigate to="/haccp" replace />} />
                    <Route element={<RequirePermission anyOf={["POS_INTEGRATION_VIEW", "POS_INTEGRATION_MANAGE"]} />}>
                      <Route path="pos" element={<Navigate to="/admin/settings?tab=pos" replace />} />
                    </Route>
                    <Route element={<RequirePermission anyOf={["POS_INTEGRATION_MANAGE"]} />}>
                      <Route path="pos/simulator" element={<Navigate to="/admin/settings?tab=pos" replace />} />
                    </Route>
                    <Route path="payables" element={<Navigate to="/reports?tab=payables" replace />} />
                    <Route path="owner-expenses" element={<Navigate to="/reports?tab=owner-expenses" replace />} />
                    {/* security tab is admin-only, handled inside AdminSettingsHub via tab visibility */}
                    <Route element={<AdminGuard />}>
                      <Route path="security" element={<Navigate to="/admin/settings?tab=security" replace />} />
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
