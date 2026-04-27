import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Cake,
  CalendarClock,
  Banknote,
  CreditCard,
  ArrowUpRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Member, Activity as ActivityType } from "@shared/schema";

const statusBadgeColors: Record<string, string> = {
  active:
    "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60",
  expiring:
    "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60",
  expired:
    "bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60",
  frozen:
    "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/60",
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

type AnalyticsResponse = {
  monthlyData: Array<{ month: string; members: number; revenue: number; attendance: number }>;
};

interface PremiumStatProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: number;
  trendLabel?: string;
  spark?: number[];
  accent?: "indigo" | "emerald" | "amber" | "violet" | "neutral";
  testId?: string;
}

const accentMap = {
  indigo: { stroke: "hsl(238, 83%, 60%)", fill: "hsl(238, 83%, 60%)", icon: "text-indigo-600 dark:text-indigo-400", chip: "bg-indigo-50 dark:bg-indigo-950/40" },
  emerald: { stroke: "hsl(160, 84%, 39%)", fill: "hsl(160, 84%, 39%)", icon: "text-emerald-600 dark:text-emerald-400", chip: "bg-emerald-50 dark:bg-emerald-950/40" },
  amber: { stroke: "hsl(32, 95%, 50%)", fill: "hsl(32, 95%, 50%)", icon: "text-amber-600 dark:text-amber-400", chip: "bg-amber-50 dark:bg-amber-950/40" },
  violet: { stroke: "hsl(263, 70%, 60%)", fill: "hsl(263, 70%, 60%)", icon: "text-violet-600 dark:text-violet-400", chip: "bg-violet-50 dark:bg-violet-950/40" },
  neutral: { stroke: "hsl(var(--muted-foreground))", fill: "hsl(var(--muted-foreground))", icon: "text-muted-foreground", chip: "bg-muted" },
} as const;

function PremiumStat({ label, value, icon: Icon, hint, trend, trendLabel, spark, accent = "neutral", testId }: PremiumStatProps) {
  const a = accentMap[accent];
  const positive = (trend ?? 0) >= 0;
  const sparkData = (spark || []).map((v, i) => ({ i, v }));
  const gradId = `g-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className="group relative rounded-2xl bg-card border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-border transition-all duration-200 overflow-hidden"
      data-testid={testId}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.chip}`}>
            <Icon className={`h-4 w-4 ${a.icon}`} />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value}</span>
          {trend !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? "+" : ""}
              {trend}%
            </span>
          )}
        </div>
        {(hint || trendLabel) && (
          <p className="mt-1 text-xs text-muted-foreground">{hint || trendLabel}</p>
        )}
      </div>
      {sparkData.length > 1 && (
        <div className="h-12 -mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={a.fill} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={a.fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={a.stroke} strokeWidth={1.75} fill={`url(#${gradId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

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

  const { data: analytics } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const displayName = user?.firstName?.trim() || user?.username || "there";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || "";
  const roleLabel = user?.role ? roleLabels[user.role] || user.role : "";
  const initials = getInitials(user?.firstName, user?.lastName, user?.username);
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  if (statsLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="dashboard-loading">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalMembers = stats?.totalMembers || 0;
  const activeMembers = stats?.activeMembers || 0;
  const expiringMembers = stats?.expiringMembers || 0;
  const expiredCount = Math.max(0, totalMembers - activeMembers - expiringMembers);
  const activePercent = Math.round((activeMembers / Math.max(totalMembers, 1)) * 100);

  const monthlyData = analytics?.monthlyData || [];
  const memberSpark = monthlyData.map((d) => d.members);
  const revenueSpark = monthlyData.map((d) => d.revenue);

  const membershipData = [
    { name: "Active", value: activeMembers, color: "hsl(160, 84%, 39%)" },
    { name: "Expiring", value: expiringMembers, color: "hsl(32, 95%, 55%)" },
    { name: "Expired", value: expiredCount, color: "hsl(0, 72%, 60%)" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="page-dashboard">
      {/* Premium hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(250,30%,12%)] via-[hsl(258,35%,16%)] to-[hsl(263,45%,22%)] text-white shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)]">
        {/* decorative mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[hsl(263,80%,55%)]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[hsl(217,91%,55%)]/20 blur-3xl" />
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-white/30 to-white/0 blur" />
                <div
                  className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 text-white text-lg font-semibold tracking-wide"
                  data-testid="avatar-user"
                >
                  {initials}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/75 font-medium">
                  <Sparkles className="h-3 w-3" />
                  <span data-testid="text-today-date">{today}</span>
                </div>
                <h1
                  className="mt-2 font-serif text-3xl sm:text-4xl lg:text-[2.6rem] leading-[1.1] tracking-tight text-white"
                  data-testid="text-dashboard-greeting"
                >
                  {getGreeting()}, <span className="italic font-normal text-white/95">{displayName}</span>
                </h1>
                <p className="mt-3 text-sm text-white/80 max-w-xl">
                  Here&apos;s how {tenant?.gymName || "your gym"} is performing today. Live metrics refresh every 30 seconds.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {roleLabel && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15"
                      data-testid="badge-user-role"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {roleLabel}
                    </span>
                  )}
                  {tenant?.gymName && (
                    <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white/85 ring-1 ring-white/15" data-testid="text-tenant-name">
                      {tenant.gymName}
                    </span>
                  )}
                  {fullName && (
                    <span className="text-xs text-white/50" data-testid="text-signed-in-as">
                      Signed in as <span className="text-white/80 font-medium">{fullName}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Hero quick metrics */}
            <div className="grid grid-cols-3 gap-px rounded-2xl bg-white/10 ring-1 ring-white/10 overflow-hidden w-full xl:w-auto">
              <div className="bg-gradient-to-b from-white/5 to-transparent p-4 xl:px-6">
                <p className="text-xs uppercase tracking-wider text-white/70 font-medium">Members</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{totalMembers}</p>
              </div>
              <div className="bg-gradient-to-b from-white/5 to-transparent p-4 xl:px-6">
                <p className="text-xs uppercase tracking-wider text-white/70 font-medium">Active</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {activePercent}<span className="text-sm text-white/70">%</span>
                </p>
              </div>
              <div className="bg-gradient-to-b from-white/5 to-transparent p-4 xl:px-6">
                <p className="text-xs uppercase tracking-wider text-white/70 font-medium">MRR</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{fmt(stats?.monthlyRevenue || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Headline KPIs */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Performance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Trends over the last 6 months</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <PremiumStat
            label="Total Members"
            value={totalMembers}
            icon={Users}
            trend={stats?.memberGrowth || 0}
            trendLabel="vs last month"
            spark={memberSpark}
            accent="indigo"
            testId="stat-total-members"
          />
          <PremiumStat
            label="Active"
            value={activeMembers}
            icon={TrendingUp}
            hint={`${activePercent}% of total roster`}
            spark={memberSpark}
            accent="emerald"
            testId="stat-active-members"
          />
          <PremiumStat
            label="Monthly Revenue"
            value={fmt(stats?.monthlyRevenue || 0)}
            icon={DollarSign}
            trend={stats?.revenueGrowth || 0}
            trendLabel="vs last month"
            spark={revenueSpark}
            accent="violet"
            testId="stat-monthly-revenue"
          />
          <PremiumStat
            label="Expiring Soon"
            value={expiringMembers}
            icon={AlertTriangle}
            hint="Within next 7 days"
            accent="amber"
            testId="stat-expiring-soon"
          />
        </div>
      </section>

      {/* Revenue trend + Membership donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">Revenue Trend</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 6 months · {fmt(monthlyData.reduce((s, m) => s + m.revenue, 0))} total
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/analytics")}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
              data-testid="link-view-analytics"
            >
              View analytics <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56">
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No revenue history yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(263, 70%, 60%)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(263, 70%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => fmt(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        fontSize: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      }}
                      formatter={(value: number) => [fmt(value), "Revenue"]}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(263, 70%, 55%)"
                      strokeWidth={2}
                      fill="url(#revGrad)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">Membership Status</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution across your roster</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {membershipData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{totalMembers}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {membershipData.map((item) => {
                const pct = totalMembers > 0 ? Math.round((item.value / totalMembers) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-medium text-foreground">{item.value}</span>
                      <span className="text-muted-foreground w-9 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today snapshot */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Today</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live snapshot of activity in the last 24 hours</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <PremiumStat
            label="Sales Today"
            value={fmt(salesToday?.perDay || 0)}
            icon={DollarSign}
            hint={`${salesToday?.count || 0} transactions`}
            accent="indigo"
            testId="stat-sales-today"
          />
          <PremiumStat
            label="Cash"
            value={fmt(salesToday?.cash || 0)}
            icon={Banknote}
            hint="Settled today"
            accent="emerald"
            testId="stat-cash"
          />
          <PremiumStat
            label="Card / Online"
            value={fmt(salesToday?.credit || 0)}
            icon={CreditCard}
            hint="Settled today"
            accent="violet"
            testId="stat-credit"
          />
          <PremiumStat
            label="Birthdays"
            value={alerts?.birthdaysToday?.length || 0}
            icon={Cake}
            hint="Reach out & wish"
            accent="amber"
            testId="stat-birthdays"
          />
          <PremiumStat
            label="Expiries"
            value={alerts?.expiringSoon?.length || 0}
            icon={CalendarClock}
            hint="Renewal needed"
            accent="amber"
            testId="stat-expiries"
          />
        </div>
      </section>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <Cake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Birthdays Today</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Send a personal note</p>
              </div>
            </div>
            {(alerts?.birthdaysToday || []).length > 0 && (
              <Badge variant="secondary" className="font-normal tabular-nums">
                {alerts!.birthdaysToday.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {(alerts?.birthdaysToday || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-birthdays">
                No birthdays today
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {alerts!.birthdaysToday.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="group w-full flex items-center gap-3 py-3 px-1 text-left hover-elevate active-elevate-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/members/${m.id}`)}
                    data-testid={`birthday-${m.id}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-semibold ring-1 ring-amber-200/60 dark:ring-amber-900/40">
                      {(m.firstName[0] || "") + (m.lastName[0] || "")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                <CalendarClock className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Expiring Soon</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Renewals in next 7 days</p>
              </div>
            </div>
            {(alerts?.expiringSoon || []).length > 0 && (
              <Badge variant="secondary" className="font-normal tabular-nums">
                {alerts!.expiringSoon.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {(alerts?.expiringSoon || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-expiries">
                No expirations in next 7 days
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {alerts!.expiringSoon.slice(0, 5).map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="w-full flex items-center gap-3 py-3 px-1 text-left hover-elevate active-elevate-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/members/${m.id}`)}
                    data-testid={`expiry-${m.id}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-950/30 text-red-700 dark:text-red-300 text-xs font-semibold ring-1 ring-red-200/60 dark:ring-red-900/40">
                      {(m.firstName[0] || "") + (m.lastName[0] || "")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 tabular-nums ${
                        m.daysLeft <= 1
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
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
      </div>

      {/* Recent members + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle className="text-sm font-semibold">Recent Members</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => navigate("/members")}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
              data-testid="link-view-all-members"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {membersLoading ? (
              <div className="space-y-3 py-2">
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
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-members">
                No members yet
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {(recentMembers || []).slice(0, 5).map((member) => (
                  <button
                    type="button"
                    key={member.id}
                    className="w-full flex items-center justify-between gap-3 py-3 px-1 text-left hover-elevate active-elevate-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate(`/members/${member.id}`)}
                    data-testid={`member-row-${member.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold ring-1 ring-indigo-200/60 dark:ring-indigo-900/40">
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

        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
                <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {activityLoading ? (
              <div className="space-y-3 py-2">
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
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-activity">
                No recent activity
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {(recentActivity || []).slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-3 px-1"
                    data-testid={`activity-row-${activity.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {activity.createdAt ? format(new Date(activity.createdAt), "MMM d · h:mm a") : ""}
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
