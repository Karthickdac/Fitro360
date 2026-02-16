import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Settings,
  LogOut,
  Dumbbell,
  Activity,
  Shield,
  CalendarDays,
  Package,
  Truck,
  FileText,
  UserCheck,
  Bell,
  Tag,
  Gift,
  GitBranch,
  Wrench,
  DollarSign,
  BarChart3,
  Home,
  Award,
  TrendingUp,
  User,
  ChevronRight,
  FileBarChart,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

const platformAdminMainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Tenants", url: "/admin/tenants", icon: Building2 },
  { title: "Plans", url: "/admin/plans", icon: CreditCard },
];

const platformAdminMonitorItems = [
  { title: "Reports", url: "/admin/reports", icon: FileBarChart },
  { title: "Activity", url: "/admin/activity", icon: Activity },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
];

const platformAdminSystemItems = [
  { title: "Settings", url: "/admin/settings", icon: Shield },
];

const memberItems = [
  { title: "Dashboard", url: "/portal", icon: LayoutDashboard },
  { title: "My Schedule", url: "/portal/schedule", icon: CalendarDays },
  { title: "My Progress", url: "/portal/progress", icon: TrendingUp },
  { title: "My Profile", url: "/portal/profile", icon: User },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const trainerItems = [
  { title: "My Portal", url: "/portal", icon: Home },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const managerMainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Trainers", url: "/trainers", icon: Dumbbell },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
];

const managerSystemItems = [
  { title: "Branches", url: "/branches", icon: GitBranch },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

const gymMainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Trainers", url: "/trainers", icon: Dumbbell },
  { title: "Trainer Mgmt", url: "/trainer-management", icon: Award },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
];

const gymErpItems = [
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Invoices", url: "/invoicing", icon: FileText },
  { title: "Payments", url: "/payments", icon: DollarSign },
];

const gymMarketingItems = [
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Referrals", url: "/referrals", icon: Gift },
];

const gymSystemItems = [
  { title: "Branches", url: "/branches", icon: GitBranch },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

function NavGroup({ label, items, location, navigate }: {
  label: string;
  items: { title: string; url: string; icon: any }[];
  location: string;
  navigate: (to: string) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] uppercase tracking-widest font-semibold text-sidebar-foreground/40 px-3 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  data-active={isActive}
                  className={isActive ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"}
                >
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.url);
                    }}
                    data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`} />
                    <span>{item.title}</span>
                    {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/60" />}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const roleColorMap: Record<string, string> = {
  platform_admin: "bg-rose-500",
  gym_owner: "bg-blue-500",
  manager: "bg-violet-500",
  trainer: "bg-emerald-500",
  member: "bg-amber-500",
  sales_executive: "bg-cyan-500",
};

const roleBadgeMap: Record<string, string> = {
  platform_admin: "bg-rose-500/20 text-rose-300",
  gym_owner: "bg-blue-500/20 text-blue-300",
  manager: "bg-violet-500/20 text-violet-300",
  trainer: "bg-emerald-500/20 text-emerald-300",
  member: "bg-amber-500/20 text-amber-300",
  sales_executive: "bg-cyan-500/20 text-cyan-300",
};

export function AppSidebar() {
  const { user, tenant, logout } = useAuth();
  const [location, navigate] = useLocation();

  if (!user) return null;

  const role = user.role;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  const roleLabel = role === "platform_admin" ? "Admin"
    : role === "member" ? "Member"
    : role === "trainer" ? "Trainer"
    : role === "manager" ? "Manager"
    : role === "sales_executive" ? "Sales"
    : "Owner";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate text-white" data-testid="text-app-name">
              {tenant?.appDisplayName || tenant?.gymName || "Fitro360"}
            </span>
            <span className="text-[11px] text-sidebar-foreground/50 truncate">
              {role === "platform_admin" ? "Platform Admin" : tenant?.gymName || "Gym Management"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="opacity-20" />
      <SidebarContent className="px-1">
        {role === "platform_admin" && (
          <>
            <NavGroup label="Platform" items={platformAdminMainItems} location={location} navigate={navigate} />
            <NavGroup label="Monitoring" items={platformAdminMonitorItems} location={location} navigate={navigate} />
            <NavGroup label="System" items={platformAdminSystemItems} location={location} navigate={navigate} />
          </>
        )}
        {role === "member" && (
          <NavGroup label="My Gym" items={memberItems} location={location} navigate={navigate} />
        )}
        {role === "trainer" && (
          <NavGroup label="My Workspace" items={trainerItems} location={location} navigate={navigate} />
        )}
        {role === "manager" && (
          <>
            <NavGroup label="Gym Management" items={managerMainItems} location={location} navigate={navigate} />
            <NavGroup label="System" items={managerSystemItems} location={location} navigate={navigate} />
          </>
        )}
        {(role === "gym_owner" || role === "sales_executive") && (
          <>
            <NavGroup label="Gym Management" items={gymMainItems} location={location} navigate={navigate} />
            <NavGroup label="Equipment & Sales" items={gymErpItems} location={location} navigate={navigate} />
            <NavGroup label="Marketing" items={gymMarketingItems} location={location} navigate={navigate} />
            <NavGroup label="System" items={gymSystemItems} location={location} navigate={navigate} />
          </>
        )}
      </SidebarContent>
      <SidebarSeparator className="opacity-20" />
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className={`${roleColorMap[role] || "bg-blue-500"} text-white text-xs font-bold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-sm font-semibold truncate text-sidebar-foreground" data-testid="text-user-name">
              {user.firstName} {user.lastName}
            </span>
            <Badge variant="secondary" className={`w-fit text-[10px] px-1.5 py-0 font-medium border-0 ${roleBadgeMap[role] || "bg-blue-500/20 text-blue-300"}`}>
              {roleLabel}
            </Badge>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
