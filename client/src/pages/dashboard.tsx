import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, TrendingUp, AlertTriangle, Calendar, Activity } from "lucide-react";
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
import type { Member, Activity as ActivityType } from "@shared/schema";

const CHART_COLORS = [
  "hsl(217, 91%, 35%)",
  "hsl(173, 58%, 39%)",
  "hsl(32, 95%, 44%)",
  "hsl(280, 65%, 45%)",
  "hsl(340, 75%, 42%)",
];

export default function DashboardPage() {
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
        />
        <StatCard
          title="Active Members"
          value={stats?.activeMembers || 0}
          icon={TrendingUp}
          subtitle={`${Math.round(((stats?.activeMembers || 0) / Math.max(stats?.totalMembers || 1, 1)) * 100)}% of total`}
        />
        <StatCard
          title="Monthly Revenue"
          value={`AED ${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: stats?.revenueGrowth || 8, label: "vs last month" }}
        />
        <StatCard
          title="Expiring Soon"
          value={stats?.expiringMembers || 0}
          icon={AlertTriangle}
          subtitle="Within 7 days"
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`AED ${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(217, 91%, 35%)" radius={[4, 4, 0, 0]} />
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
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {membershipData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
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
              <div className="space-y-3">
                {(recentMembers || []).slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3"
                    data-testid={`member-row-${member.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant={member.status === "active" ? "default" : member.status === "expiring" ? "secondary" : "destructive"}
                      className="shrink-0"
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
              <div className="space-y-3">
                {(recentActivity || []).slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3"
                    data-testid={`activity-row-${activity.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
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
