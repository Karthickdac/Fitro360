import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import type { Member, Activity as ActivityType } from "@shared/schema";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(32, 95%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
];

const statusBadgeColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  expiring: "bg-amber-100 text-amber-700 border-amber-200",
  expired: "bg-red-100 text-red-700 border-red-200",
  frozen: "bg-sky-100 text-sky-700 border-sky-200",
};

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

const activityIconColors = [
  "bg-blue-100 text-blue-600", "bg-emerald-100 text-emerald-600",
  "bg-violet-100 text-violet-600", "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
];

export default function DashboardPage() {
  const { fmt, fmtShort } = useMarket();
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalMembers: number;
    activeMembers: number;
    expiringMembers: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    memberGrowth: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: recentMembers, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery<ActivityType[]>({
    queryKey: ["/api/activities"],
  });

  const membershipData = [
    { name: "Active", value: stats?.activeMembers || 0, color: CHART_COLORS[0] },
    { name: "Expiring", value: stats?.expiringMembers || 0, color: CHART_COLORS[2] },
    { name: "Expired", value: Math.max(0, (stats?.totalMembers || 0) - (stats?.activeMembers || 0) - (stats?.expiringMembers || 0)), color: CHART_COLORS[4] },
  ];

  const revenueData = [
    { month: "Jan", revenue: 12400 },
    { month: "Feb", revenue: 13100 },
    { month: "Mar", revenue: 14200 },
    { month: "Apr", revenue: 13800 },
    { month: "May", revenue: 15600 },
    { month: "Jun", revenue: stats?.monthlyRevenue || 16200 },
  ];

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="dashboard-loading">
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

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={stats?.totalMembers || 0}
          icon={Users}
          trend={{ value: stats?.memberGrowth || 12, label: "vs last month" }}
          color="blue"
        />
        <StatCard
          title="Active Members"
          value={stats?.activeMembers || 0}
          icon={TrendingUp}
          subtitle={`${Math.round(((stats?.activeMembers || 0) / Math.max(stats?.totalMembers || 1, 1)) * 100)}% of total`}
          color="emerald"
        />
        <StatCard
          title="Monthly Revenue"
          value={fmt(stats?.monthlyRevenue || 0)}
          icon={DollarSign}
          trend={{ value: stats?.revenueGrowth || 8, label: "vs last month" }}
          color="violet"
        />
        <StatCard
          title="Expiring Soon"
          value={stats?.expiringMembers || 0}
          icon={AlertTriangle}
          subtitle="Within 7 days"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(250, 80%, 60%)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => fmtShort(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [fmt(value), "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Membership Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
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
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {membershipData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Members</CardTitle>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(recentMembers || []).slice(0, 5).map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`member-row-${member.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${avatarColors[idx % avatarColors.length]} text-white text-sm font-bold`}>
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize border ${statusBadgeColors[member.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}
                    >
                      {member.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(recentActivity || []).slice(0, 5).map((activity, idx) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`activity-row-${activity.id}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activityIconColors[idx % activityIconColors.length]}`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.createdAt ? format(new Date(activity.createdAt), "MMM d, h:mm a") : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {(!recentActivity || recentActivity.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
