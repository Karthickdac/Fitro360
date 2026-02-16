import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import type { Tenant } from "@shared/schema";

export default function AdminDashboardPage() {
  const { fmt, fmtShort } = useMarket();
  const { data: stats, isLoading } = useQuery<{
    totalTenants: number;
    activeTenants: number;
    mrr: number;
    mrrGrowth: number;
    totalMembers: number;
    churnRate: number;
  }>({ queryKey: ["/api/admin/stats"] });

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const mrrData = [
    { month: "Jan", mrr: 2400 },
    { month: "Feb", mrr: 3100 },
    { month: "Mar", mrr: 4200 },
    { month: "Apr", mrr: 4800 },
    { month: "May", mrr: 5600 },
    { month: "Jun", mrr: stats?.mrr || 6200 },
  ];

  const tenantGrowthData = [
    { month: "Jan", tenants: 8 },
    { month: "Feb", tenants: 12 },
    { month: "Mar", tenants: 18 },
    { month: "Apr", tenants: 22 },
    { month: "May", tenants: 28 },
    { month: "Jun", tenants: stats?.totalTenants || 32 },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="admin-dashboard-loading">
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
    <div className="p-6 space-y-6" data-testid="page-admin-dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Monitor your SaaS platform performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Tenants"
          value={stats?.totalTenants || 0}
          icon={Building2}
          color="blue"
          trend={{ value: 15, label: "vs last month" }}
        />
        <StatCard
          title="Monthly Revenue"
          value={fmt(stats?.mrr || 0)}
          icon={DollarSign}
          color="violet"
          trend={{ value: stats?.mrrGrowth || 12, label: "vs last month" }}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats?.activeTenants || 0}
          icon={TrendingUp}
          color="emerald"
          subtitle={`${Math.round(((stats?.activeTenants || 0) / Math.max(stats?.totalTenants || 1, 1)) * 100)}% active rate`}
        />
        <StatCard
          title="Total Members"
          value={stats?.totalMembers || 0}
          icon={Users}
          color="amber"
          subtitle="Across all gyms"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">MRR Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v: number) => fmtShort(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [fmt(value), "MRR"]}
                  />
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="url(#mrrGradient)"
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", r: 5, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ fill: "#6366f1", r: 7, strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Tenant Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenantGrowthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <defs>
                    <linearGradient id="tenantGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="tenants" fill="url(#tenantGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(tenants || []).slice(0, 5).map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border"
                data-testid={`tenant-row-${tenant.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const avatarColors = ["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"];
                    const colorIdx = typeof tenant.id === 'string' ? tenant.id.charCodeAt(0) % avatarColors.length : 0;
                    return (
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white font-semibold text-sm ${avatarColors[colorIdx]}`}
                      >
                        {tenant.gymName.charAt(0)}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{tenant.gymName}</p>
                    <p className="text-xs text-muted-foreground truncate">{tenant.domain || "No domain"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`capitalize ${
                    tenant.subscriptionPlan === 'enterprise' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                    tenant.subscriptionPlan === 'pro' ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                    'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                    {tenant.subscriptionPlan}
                  </Badge>
                  <Badge variant="outline" className={tenant.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}>
                    {tenant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
