import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Activity,
  Cake,
  CalendarClock,
  Banknote,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Member, Activity as ActivityType } from "@shared/schema";

const CHART_COLORS = {
  active: "hsl(160, 84%, 39%)",
  expiring: "hsl(32, 95%, 55%)",
  expired: "hsl(0, 72%, 60%)",
};

const statusBadgeColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  expiring: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  expired: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  frozen: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900",
};

const roleLabels: Record<string, string> = {
  gym_owner: "Owner",
  manager: "Manager",
  sales_executive: "Sales Executive",
  trainer: "Trainer",
  member: "Member",
  platform_admin: "Platform Admin",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(firstName?: string | null, lastName?: string | null, username?: string | null): string {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  if (f || l) return `${f[0] || ""}${l[0] || ""}`.toUpperCase();
  return (username || "U").slice(0, 2).toUpperCase();
}

type SalesToday = { perDay: number; cash: number; credit: number; count: number };
type DashboardAlerts = {
  birthdaysToday: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  expiringSoon: Array<{ id: string; firstName: string; lastName: string; email: string; membershipEnd: string | null; daysLeft: number }>;
  todaysSessions: Array<{ id: string; memberName: string; trainerName: string; startTime: string; endTime: string }>;
};

export default function DashboardPage() {
  const { fmt } = useMarket();
  const [, navigate] = useLocation();
  const { user, tenant } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalMembers: number;
    activeMembers: number;
    expiringMembers: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    memberGrowth: number;
  }>({ queryKey: ["/api/dashboard/stats"], refetchInterval: 30000 });

  const { data: salesToday } = useQuery<SalesToday>({
    queryKey: ["/api/dashboard/sales-today"],
    refetchInterval: 30000,
  });

  const { data: alerts } = useQuery<DashboardAlerts>({
    queryKey: ["/api/dashboard/alerts"],
    refetchInterval: 60000,
  });

  const { data: recentMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery<ActivityType[]>({
    queryKey: ["/api/activities"],
  });

  const displayName = user?.firstName?.trim() || user?.username || "there";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || "";
  const roleLabel = user?.role ? roleLabels[user.role] || user.role : "";
  const initials = getInitials(user?.firstName, user?.lastName, user?.username);
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  if (statsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="dashboard-loading">
        <Card className="border">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalMembers = stats?.totalMembers || 0;
  const activeMembers = stats?.activeMembers || 0;
  const expiringMembers = stats?.expiringMembers || 0;
  const expiredCount = Math.max(0, totalMembers - activeMembers - expiringMembers);
  const activePercent = Math.round((activeMembers / Math.max(totalMembers, 1)) * 100);

  const membershipData = [
    { name: "Active", value: activeMembers, color: CHART_COLORS.active },
    { name: "Expiring", value: expiringMembers, color: CHART_COLORS.expiring },
    { name: "Expired", value: expiredCount, color: CHART_COLORS.expired },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="page-dashboard">
      {/* Personalized greeting */}
      <Card className="border">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-semibold"
                data-testid="avatar-user"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h1
                  className="text-xl sm:text-2xl font-semibold tracking-tight truncate"
                  data-testid="text-dashboard-greeting"
                >
                  {getGreeting()}, {displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
                  {roleLabel && (
                    <Badge variant="secondary" className="font-normal" data-testid="badge-user-role">
                      {roleLabel}
                    </Badge>
                  )}
                  {tenant?.gymName && (
                    <span data-testid="text-tenant-name" className="truncate">
                      {tenant.gymName}
                    </span>
                  )}
                  {tenant?.gymName && <span className="hidden sm:inline">·</span>}
                  <span data-testid="text-today-date">{today}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right shrink-0">
              <p>Live data · refreshes every 30s</p>
              {fullName && (
                <p className="mt-0.5" data-testid="text-signed-in-as">
                  Signed in as <span className="font-medium text-foreground">{fullName}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Headline stats */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Members"
            value={totalMembers}
            icon={Users}
            trend={{ value: stats?.memberGrowth || 0, label: "vs last month" }}
          />
          <StatCard
            title="Active Members"
            value={activeMembers}
            icon={TrendingUp}
            subtitle={`${activePercent}% of total`}
          />
          <StatCard
            title="Monthly Revenue"
            value={fmt(stats?.monthlyRevenue || 0)}
            icon={DollarSign}
            trend={{ value: stats?.revenueGrowth || 0, label: "vs last month" }}
          />
          <StatCard
            title="Expiring Soon"
            value={expiringMembers}
            icon={AlertTriangle}
            subtitle="Within 7 days"
          />
        </div>
      </section>

      {/* Today */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Today</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            title="Sales Today"
            value={fmt(salesToday?.perDay || 0)}
            icon={DollarSign}
            subtitle={`${salesToday?.count || 0} transactions`}
            color="blue"
          />
          <StatCard
            title="Cash"
            value={fmt(salesToday?.cash || 0)}
            icon={Banknote}
            subtitle="Today"
            color="emerald"
          />
          <StatCard
            title="Card / Online"
            value={fmt(salesToday?.credit || 0)}
            icon={CreditCard}
            subtitle="Today"
            color="violet"
          />
          <StatCard
            title="Birthdays"
            value={alerts?.birthdaysToday?.length || 0}
            icon={Cake}
            subtitle="Reach out & wish"
            color="amber"
          />
          <StatCard
            title="Expiries"
            value={alerts?.expiringSoon?.length || 0}
            icon={CalendarClock}
            subtitle="Renewal needed"
            color="amber"
          />
        </div>
      </section>

      {/* Alerts + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Birthdays Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(alerts?.birthdaysToday || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-birthdays">
                No birthdays today
              </p>
            ) : (
              <div className="space-y-1">
                {alerts!.birthdaysToday.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate active-elevate-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/members/${m.id}`)}
                    data-testid={`birthday-${m.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold">
                      {(m.firstName[0] || "") + (m.lastName[0] || "")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-red-600 dark:text-red-400" />
              Expiring Soon
              <span className="text-xs font-normal text-muted-foreground">(next 7 days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(alerts?.expiringSoon || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-expiries">
                No expirations in next 7 days
              </p>
            ) : (
              <div className="space-y-1">
                {alerts!.expiringSoon.slice(0, 5).map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate active-elevate-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/members/${m.id}`)}
                    data-testid={`expiry-${m.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${
                        m.daysLeft <= 1
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                      }`}
                    >
                      {m.daysLeft <= 0 ? "Today" : `${m.daysLeft}d`}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Membership Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={66}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {membershipData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {membershipData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">
                    {item.name} <span className="font-medium text-foreground">({item.value})</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent members + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Recent Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (recentMembers || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-members">
                No members yet
              </p>
            ) : (
              <div className="space-y-1">
                {(recentMembers || []).slice(0, 5).map((member) => (
                  <button
                    type="button"
                    key={member.id}
                    className="w-full flex items-center justify-between gap-3 p-2 rounded-md hover-elevate active-elevate-2 text-left"
                    onClick={() => navigate(`/members/${member.id}`)}
                    data-testid={`member-row-${member.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold">
                        {(member.firstName?.[0] || "") + (member.lastName?.[0] || "")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize ${
                        statusBadgeColors[member.status] ||
                        "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {member.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (recentActivity || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-activity">
                No recent activity
              </p>
            ) : (
              <div className="space-y-1">
                {(recentActivity || []).slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-2 rounded-md"
                    data-testid={`activity-row-${activity.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.createdAt ? format(new Date(activity.createdAt), "MMM d, h:mm a") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
