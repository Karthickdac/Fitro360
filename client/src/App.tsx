import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import MembersPage from "@/pages/members";
import MemberDetailPage from "@/pages/member-detail";
import TrainersPage from "@/pages/trainers";
import ActivityPage from "@/pages/activity";
import SchedulePage from "@/pages/schedule";
import SettingsPage from "@/pages/settings";
import InventoryPage from "@/pages/inventory";
import SuppliersPage from "@/pages/suppliers";
import InvoicingPage from "@/pages/invoicing";
import BranchesPage from "@/pages/branches";
import CheckInPage from "@/pages/check-in";
import NotificationsPage from "@/pages/notifications";
import CouponsPage from "@/pages/coupons";
import ReferralsPage from "@/pages/referrals";
import AnalyticsPage from "@/pages/analytics";
import MaintenancePage from "@/pages/maintenance";
import PaymentsPage from "@/pages/payments";
import MemberPortalPage from "@/pages/member-portal";
import TrainerPortalPage from "@/pages/trainer-portal";
import TrainerManagementPage from "@/pages/trainer-management";
import ReportsPage from "@/pages/reports";
import AdminDashboardPage from "@/pages/admin/dashboard";
import TenantsPage from "@/pages/admin/tenants";
import PlansPage from "@/pages/admin/plans";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminReportsPage from "@/pages/admin/reports";
import MembershipPlansPage from "@/pages/membership-plans";
import TaxSettingsPage from "@/pages/tax-settings";
import SupplierBillsPage from "@/pages/supplier-bills";
import VatReturnsPage from "@/pages/vat-returns";
import CorporateTaxPage from "@/pages/corporate-tax";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-md bg-primary animate-pulse" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/admin" />} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/tenants" component={TenantsPage} />
      <Route path="/admin/plans" component={PlansPage} />
      <Route path="/admin/reports" component={AdminReportsPage} />
      <Route path="/admin/activity" component={ActivityPage} />
      <Route path="/admin/notifications" component={NotificationsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MemberRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/portal" />} />
      <Route path="/portal" component={() => <MemberPortalPage initialTab="dashboard" />} />
      <Route path="/portal/schedule" component={() => <MemberPortalPage initialTab="sessions" />} />
      <Route path="/portal/progress" component={() => <MemberPortalPage initialTab="progress" />} />
      <Route path="/portal/profile" component={() => <MemberPortalPage initialTab="profile" />} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function TrainerRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/portal" />} />
      <Route path="/portal" component={TrainerPortalPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/members" component={MembersPage} />
      <Route path="/check-in" component={CheckInPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ManagerRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/members" component={MembersPage} />
      <Route path="/members/:id" component={MemberDetailPage} />
      <Route path="/trainers" component={TrainersPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/check-in" component={CheckInPage} />
      <Route path="/branches" component={BranchesPage} />
      <Route path="/membership-plans" component={MembershipPlansPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GymOwnerRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/members" component={MembersPage} />
      <Route path="/members/:id" component={MemberDetailPage} />
      <Route path="/trainers" component={TrainersPage} />
      <Route path="/trainer-management" component={TrainerManagementPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/check-in" component={CheckInPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/suppliers" component={SuppliersPage} />
      <Route path="/invoicing" component={InvoicingPage} />
      <Route path="/maintenance" component={MaintenancePage} />
      <Route path="/payments" component={PaymentsPage} />
      <Route path="/branches" component={BranchesPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/coupons" component={CouponsPage} />
      <Route path="/referrals" component={ReferralsPage} />
      <Route path="/membership-plans" component={MembershipPlansPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/tax-settings" component={TaxSettingsPage} />
      <Route path="/supplier-bills" component={SupplierBillsPage} />
      <Route path="/vat-returns" component={VatReturnsPage} />
      <Route path="/corporate-tax" component={CorporateTaxPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const getRouter = () => {
    switch (user?.role) {
      case "platform_admin": return <AdminRouter />;
      case "member": return <MemberRouter />;
      case "trainer": return <TrainerRouter />;
      case "manager": return <ManagerRouter />;
      case "sales_executive": return <GymOwnerRouter />;
      default: return <GymOwnerRouter />;
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {getRouter()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
