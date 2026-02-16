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
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

const platformAdminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Tenants", url: "/admin/tenants", icon: Building2 },
  { title: "Plans", url: "/admin/plans", icon: CreditCard },
];

const memberItems = [
  { title: "My Portal", url: "/portal", icon: Home },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
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
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

const gymMainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Trainers", url: "/trainers", icon: Dumbbell },
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
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                data-active={location === item.url}
              >
                <a
                  href={item.url}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.url);
                  }}
                  data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { user, tenant, logout } = useAuth();
  const [location, navigate] = useLocation();

  if (!user) return null;

  const role = user.role;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  const roleLabel = role === "platform_admin" ? "Platform Admin"
    : role === "member" ? "Member"
    : role === "trainer" ? "Trainer"
    : role === "manager" ? "Manager"
    : role === "sales_executive" ? "Sales Executive"
    : "Gym Owner";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate" data-testid="text-app-name">
              {tenant?.appDisplayName || tenant?.gymName || "Fitro360"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {role === "platform_admin" ? "Platform Admin" : tenant?.gymName || "Gym Management"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {role === "platform_admin" && (
          <>
            <NavGroup label="Platform" items={platformAdminItems} location={location} navigate={navigate} />
            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild data-active={location === "/admin/settings"}>
                      <a href="/admin/settings" onClick={(e) => { e.preventDefault(); navigate("/admin/settings"); }} data-testid="link-nav-admin-settings">
                        <Shield className="h-4 w-4" />
                        <span>Settings</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate" data-testid="text-user-name">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {roleLabel}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
