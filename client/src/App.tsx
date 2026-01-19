console.log('[DIAG] App.tsx loaded');

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import React from "react";

const NotFound = React.lazy(() => import("@/pages/not-found"));
const Login = React.lazy(() => import("@/pages/login"));
const CashierPOS = React.lazy(() => import("@/pages/cashier"));
const ManagerDashboard = React.lazy(() => import("@/pages/manager"));
const AdminDashboard = React.lazy(() => import("@/pages/admin"));
const BaristaScreen = React.lazy(() => import("@/pages/barista"));
const CourierScreen = React.lazy(() => import("@/pages/courier"));
const KioskPage = React.lazy(() => import("@/pages/kiosk"));
const KitchenDisplay = React.lazy(() => import("@/pages/kitchen-display"));
const LeaderboardPage = React.lazy(() => import("@/pages/leaderboard"));
const StrategicReports = React.lazy(() => import("@/pages/strategic-reports"));
const AdminBackupPage = React.lazy(() => import("@/pages/admin-backup").then(module => ({ default: module.AdminBackupPage })));

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <Switch>
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Login} />
            <Route path="/login" component={Login} />
          </>
        ) : (
          <>
            {/* Route authenticated users to their role-specific dashboard */}
            <Route
              path="/"
              component={() => {
                const roleRoutes = {
                  admin: AdminDashboard,
                  manager: ManagerDashboard,
                  cashier: CashierPOS,
                  barista: BaristaScreen,
                  courier: CourierScreen,
                } as const;
                const Component =
                  roleRoutes[(user as any)?.role as keyof typeof roleRoutes] ||
                  ManagerDashboard;
                return <Component />;
              }}
            />
            <Route path="/admin/backups" component={AdminBackupPage} />
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/cashier" component={CashierPOS} />
            <Route path="/manager" component={ManagerDashboard} />
            <Route path="/barista" component={BaristaScreen} />
            <Route path="/courier" component={CourierScreen} />
            <Route path="/kiosk" component={KioskPage} />
            <Route path="/kitchen" component={KitchenDisplay} />
            <Route path="/leaderboard" component={LeaderboardPage} />
            <Route path="/reports/strategic" component={StrategicReports} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(_error: any, _errorInfo: any) {
    // no-op for now
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <pre className="text-sm text-red-500">{this.state.error?.toString()}</pre>
            <p className="mt-2 text-gray-600">Please contact support or check your code for context provider issues.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
