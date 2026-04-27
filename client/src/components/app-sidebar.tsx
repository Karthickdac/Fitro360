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
  FileBarChart,
  Receipt,
  Calculator,
  ScrollText,
  Landmark,
  ShoppingCart,
  Sparkles,
  ArrowRightLeft,
  Boxes,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: any; badge?: string };

const platformAdminMainItems: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Tenants", url: "/admin/tenants", icon: Building2 },
  { title: "Plans", url: "/admin/plans", icon: CreditCard },
];

const platformAdminMonitorItems: NavItem[] = [
  { title: "Reports", url: "/admin/reports", icon: FileBarChart },
  { title: "Activity", url: "/admin/activity", icon: Activity },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
];

const platformAdminSystemItems: NavItem[] = [
  { title: "Settings", url: "/admin/settings", icon: Shield },
];

const memberItems: NavItem[] = [
  { title: "Dashboard", url: "/portal", icon: LayoutDashboard },
  { title: "My Schedule", url: "/portal/schedule", icon: CalendarDays },
  { title: "My Progress", url: "/portal/progress", icon: TrendingUp },
  { title: "My Profile", url: "/portal/profile", icon: User },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const trainerItems: NavItem[] = [
  { title: "My Portal", url: "/portal", icon: Home },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const managerMainItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Membership Plans", url: "/membership-plans", icon: CreditCard },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Trainers", url: "/trainers", icon: Dumbbell },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
];

const managerSystemItems: NavItem[] = [
  { title: "Branches", url: "/branches", icon: GitBranch },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

const gymOverviewItems: NavItem[] = [
  { title: "Executive Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const gymMembershipItems: NavItem[] = [
  { title: "Members", url: "/members", icon: Users },
  { title: "Check-in", url: "/check-in", icon: UserCheck },
  { title: "Membership Plans", url: "/membership-plans", icon: CreditCard },
  { title: "Member Transfers", url: "/membership-transfers", icon: ArrowRightLeft },
];

const gymStaffItems: NavItem[] = [
  { title: "Trainers", url: "/trainers", icon: Dumbbell },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Trainer Management", url: "/trainer-management", icon: Award },
];

const gymOperationsItems: NavItem[] = [
  { title: "Branches", url: "/branches", icon: GitBranch },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Fixed Assets", url: "/fixed-assets", icon: Boxes },
];

const gymProcurementItems: NavItem[] = [
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Supplier Bills", url: "/supplier-bills", icon: ScrollText },
];

const gymFinanceItems: NavItem[] = [
  { title: "Invoices", url: "/invoicing", icon: FileText },
  { title: "Payments", url: "/payments", icon: DollarSign },
];

const gymComplianceItems: NavItem[] = [
  { title: "Tax Settings", url: "/tax-settings", icon: Landmark },
  { title: "VAT Returns", url: "/vat-returns", icon: Receipt },
  { title: "Corporate Tax", url: "/corporate-tax", icon: Calculator },
];

const gymGrowthItems: NavItem[] = [
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Referrals", url: "/referrals", icon: Gift },
];

const gymReportsItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Activity Log", url: "/activity", icon: Activity },
];

const gymAdminItems: NavItem[] = [
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

function isItemActive(itemUrl: string, location: string) {
  return location === itemUrl || (itemUrl !== "/" && location.startsWith(itemUrl + "/"));
}

function NavGroup({
  label,
  items,
  location,
  navigate,
  defaultOpen = true,
}: {
  label: string;
  items: NavItem[];
  location: string;
  navigate: (to: string) => void;
  defaultOpen?: boolean;
}) {
  const { state: sidebarState } = useSidebar();
  const isIconMode = sidebarState === "collapsed";
  const storageKey = `fitro360.sidebar.group.${label}`;

  const groupHasActive = items.some((i) => isItemActive(i.url, location));

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return defaultOpen;
    return stored === "true";
  });

  useEffect(() => {
    if (groupHasActive && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupHasActive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(open));
    } catch {}
  }, [open, storageKey]);

  const showItems = isIconMode || open;

  return (
    <SidebarGroup className="px-2 py-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`navgroup-${label}`}
        data-testid={`button-navgroup-${label.toLowerCase().replace(/\s|&/g, "-")}`}
        className="group/header w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[10px] uppercase tracking-[0.18em] font-semibold text-sidebar-foreground/65 hover:text-white hover:bg-sidebar-accent/30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {groupHasActive && (
            <span className="h-1 w-1 rounded-full bg-sidebar-primary shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>
      <div
        id={`navgroup-${label}`}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          showItems ? "grid-rows-[1fr] opacity-100 mt-0.5" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const isActive = isItemActive(item.url, location);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      tooltip={item.title}
                      className={cn(
                        "relative h-8 rounded-md transition-colors group/item",
                        isActive
                          ? "bg-gradient-to-r from-sidebar-accent via-sidebar-accent/85 to-transparent !text-white font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-gradient-to-b before:from-sidebar-primary before:to-violet-400 before:shadow-[0_0_10px_rgba(167,139,250,0.7)] group-data-[collapsible=icon]:before:hidden"
                          : "text-sidebar-foreground/75 hover:text-white hover:bg-sidebar-accent/45"
                      )}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(item.url);
                        }}
                        data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-sidebar-primary drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]"
                              : "text-sidebar-foreground/70 group-hover/item:text-white"
                          )}
                        />
                        <span className="text-[13px]">{item.title}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4 px-1.5 text-[9px] font-semibold bg-sidebar-primary/15 text-sidebar-primary border-0"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
}

const roleColorMap: Record<string, string> = {
  platform_admin: "bg-gradient-to-br from-rose-500 to-rose-600",
  gym_owner: "bg-gradient-to-br from-amber-500 to-amber-600",
  manager: "bg-gradient-to-br from-violet-500 to-violet-600",
  trainer: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  member: "bg-gradient-to-br from-sky-500 to-sky-600",
  sales_executive: "bg-gradient-to-br from-cyan-500 to-cyan-600",
};

const roleBadgeMap: Record<string, string> = {
  platform_admin: "bg-rose-500/15 text-rose-300 border border-rose-500/20",
  gym_owner: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
  manager: "bg-violet-500/15 text-violet-300 border border-violet-500/20",
  trainer: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  member: "bg-sky-500/15 text-sky-300 border border-sky-500/20",
  sales_executive: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20",
};

export function AppSidebar() {
  const { user, tenant, logout } = useAuth();
  const [location, navigate] = useLocation();

  if (!user) return null;

  const role = user.role;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  const roleLabel =
    role === "platform_admin"
      ? "Platform Admin"
      : role === "member"
      ? "Member"
      : role === "trainer"
      ? "Trainer"
      : role === "manager"
      ? "Manager"
      : role === "sales_executive"
      ? "Sales Executive"
      : "Gym Owner";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      {/* Premium ambient glow behind header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-500/[0.07] via-violet-500/[0.02] to-transparent"
      />
      <SidebarHeader className="relative p-4 pb-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 via-violet-500 to-violet-600 shadow-lg shadow-violet-500/30 ring-1 ring-violet-300/30">
            <Dumbbell className="h-5 w-5 text-white" strokeWidth={2.5} />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-violet-200" />
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span
              className="text-[15px] font-bold tracking-tight truncate text-white"
              data-testid="text-app-name"
            >
              {tenant?.appDisplayName || tenant?.gymName || "Fitro360"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-violet-400/90 truncate">
              {role === "platform_admin" ? "Platform Console" : "Enterprise Suite"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="opacity-40" />
      <SidebarContent className="px-0 py-2 relative">
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
            <NavGroup label="System" items={managerSystemItems} location={location} navigate={navigate} defaultOpen={false} />
          </>
        )}
        {(role === "gym_owner" || role === "sales_executive") && (
          <>
            <NavGroup label="Overview" items={gymOverviewItems} location={location} navigate={navigate} />
            <NavGroup label="Membership" items={gymMembershipItems} location={location} navigate={navigate} />
            <NavGroup label="Staff" items={gymStaffItems} location={location} navigate={navigate} />
            <NavGroup label="Finance" items={gymFinanceItems} location={location} navigate={navigate} />
            <NavGroup label="Growth" items={gymGrowthItems} location={location} navigate={navigate} defaultOpen={false} />
            <NavGroup label="Operations" items={gymOperationsItems} location={location} navigate={navigate} defaultOpen={false} />
            <NavGroup label="Procurement" items={gymProcurementItems} location={location} navigate={navigate} defaultOpen={false} />
            <NavGroup label="Reports" items={gymReportsItems} location={location} navigate={navigate} defaultOpen={false} />
            <NavGroup label="Tax & Compliance" items={gymComplianceItems} location={location} navigate={navigate} defaultOpen={false} />
            <NavGroup label="System" items={gymAdminItems} location={location} navigate={navigate} defaultOpen={false} />
          </>
        )}
      </SidebarContent>
      <SidebarSeparator className="opacity-40" />
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent/40 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <div className="relative">
            <Avatar className="h-9 w-9 ring-2 ring-sidebar-border/60">
              <AvatarFallback className={`${roleColorMap[role] || "bg-amber-500"} text-white text-xs font-bold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar shadow-sm shadow-emerald-500/50" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 gap-0.5 group-data-[collapsible=icon]:hidden">
            <span
              className="text-[13px] font-semibold truncate text-sidebar-foreground"
              data-testid="text-user-name"
            >
              {user.firstName} {user.lastName}
            </span>
            <Badge
              variant="secondary"
              className={`w-fit text-[9px] px-1.5 py-0 font-semibold uppercase tracking-wider ${roleBadgeMap[role] || "bg-amber-500/15 text-amber-300"}`}
            >
              {roleLabel}
            </Badge>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors group-data-[collapsible=icon]:hidden"
            data-testid="button-logout"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
