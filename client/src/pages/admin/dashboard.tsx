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
import type { Tenant } from "@shared/schema";

export default function AdminDashboardPage() {
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
          trend={{ value: 15, label: "vs last month" }}
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${(stats?.mrr || 0).toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: stats?.mrrGrowth || 12, label: "vs last month" }}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats?.activeTenants || 0}
          icon={TrendingUp}
          subtitle={`${Math.round(((stats?.activeTenants || 0) / Math.max(stats?.totalTenants || 1, 1)) * 100)}% active rate`}
        />
        <StatCard
          title="Total Members"
          value={stats?.totalMembers || 0}
          icon={Users}
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
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "MRR"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(217, 91%, 35%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(217, 91%, 35%)", r: 4 }}
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
                  <Bar dataKey="tenants" fill="hsl(173, 58%, 39%)" radius={[4, 4, 0, 0]} />
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
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white font-semibold text-sm"
                    style={{ backgroundColor: tenant.primaryColor || "#1e40af" }}
                  >
                    {tenant.gymName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{tenant.gymName}</p>
                    <p className="text-xs text-muted-foreground truncate">{tenant.domain || "No domain"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="capitalize">
                    {tenant.subscriptionPlan}
                  </Badge>
                  <Badge variant={tenant.isActive ? "default" : "destructive"}>
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
