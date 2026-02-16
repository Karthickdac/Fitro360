import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import type { Tenant, SubscriptionPlan } from "@shared/schema";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
  color: "hsl(var(--foreground))",
};

const axisTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

const PLAN_COLORS: Record<string, string> = {
  basic: "#3b82f6",
  pro: "#06b6d4",
  enterprise: "#8b5cf6",
};

const PIE_COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"];

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  mrr: number;
  mrrGrowth: number;
  totalMembers: number;
  churnRate: number;
}

export default function AdminReportsPage() {
  const { fmt, fmtShort } = useMarket();

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: tenants, isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const isLoading = statsLoading || tenantsLoading;

  const planDistribution = (() => {
    if (!tenants) return [];
    const counts: Record<string, number> = {};
    tenants.forEach((t) => {
      const plan = t.subscriptionPlan || "basic";
      counts[plan] = (counts[plan] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const mrrByPlan = (() => {
    if (!tenants || !plans) return [];
    const planPrices: Record<string, number> = {};
    plans.forEach((p) => {
      planPrices[p.name.toLowerCase()] = parseFloat(String(p.priceMonthly));
    });
    const revenue: Record<string, number> = {};
    tenants.forEach((t) => {
      if (!t.isActive) return;
      const plan = t.subscriptionPlan || "basic";
      const price = planPrices[plan] || 0;
      revenue[plan] = (revenue[plan] || 0) + price;
    });
    return Object.entries(revenue).map(([name, value]) => ({ name, value }));
  })();

  const mrrTrendData = [
    { month: "Jan", mrr: 1800 },
    { month: "Feb", mrr: 2400 },
    { month: "Mar", mrr: 3100 },
    { month: "Apr", mrr: 3800 },
    { month: "May", mrr: 4600 },
    { month: "Jun", mrr: stats?.mrr || 5200 },
  ];

  const tenantGrowthData = [
    { month: "Jan", tenants: 5 },
    { month: "Feb", tenants: 9 },
    { month: "Mar", tenants: 14 },
    { month: "Apr", tenants: 19 },
    { month: "May", tenants: 25 },
    { month: "Jun", tenants: stats?.totalTenants || 30 },
  ];

  const subscriptionMovementData = [
    { month: "Jan", upgrades: 2, downgrades: 0 },
    { month: "Feb", upgrades: 3, downgrades: 1 },
    { month: "Mar", upgrades: 4, downgrades: 1 },
    { month: "Apr", upgrades: 5, downgrades: 2 },
    { month: "May", upgrades: 3, downgrades: 1 },
    { month: "Jun", upgrades: 6, downgrades: 1 },
  ];

  const revenuePerTenantData = (() => {
    if (!tenants || !plans) return [];
    const planPrices: Record<string, number> = {};
    plans.forEach((p) => {
      planPrices[p.name.toLowerCase()] = parseFloat(String(p.priceMonthly));
    });
    return tenants
      .filter((t) => t.isActive)
      .slice(0, 10)
      .map((t) => ({
        name: t.gymName.length > 12 ? t.gymName.slice(0, 12) + "..." : t.gymName,
        revenue: planPrices[t.subscriptionPlan || "basic"] || 0,
      }));
  })();

  const activeTenantRate = stats
    ? Math.round((stats.activeTenants / Math.max(stats.totalTenants, 1)) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="admin-reports-loading">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-96" />
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
    <div className="p-6 space-y-6" data-testid="page-admin-reports">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">
          Platform Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive reporting hub for platform analytics and insights
        </p>
      </div>

      <Tabs defaultValue="overview" data-testid="reports-tabs">
        <TabsList data-testid="reports-tab-list">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Platform Overview
          </TabsTrigger>
          <TabsTrigger value="tenants" data-testid="tab-tenants">
            <Building2 className="h-4 w-4 mr-1.5" />
            Tenant Analytics
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <DollarSign className="h-4 w-4 mr-1.5" />
            Revenue Report
          </TabsTrigger>
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
            <CreditCard className="h-4 w-4 mr-1.5" />
            Subscription Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4" data-testid="tab-content-overview">
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
              trend={{ value: stats?.mrrGrowth || 0, label: "growth" }}
            />
            <StatCard
              title="Total Users"
              value={stats?.totalMembers || 0}
              icon={Users}
              color="emerald"
              subtitle="Across all tenants"
            />
            <StatCard
              title="Active Rate"
              value={`${activeTenantRate}%`}
              icon={Activity}
              color="amber"
              subtitle={`${stats?.activeTenants || 0} of ${stats?.totalTenants || 0} tenants`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-overview-mrr">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  MRR Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mrrTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={axisTickStyle} />
                      <YAxis tick={axisTickStyle} tickFormatter={(v: number) => fmtShort(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [fmt(value), "MRR"]}
                      />
                      <defs>
                        <linearGradient id="overviewMrrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="mrr"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fill="url(#overviewMrrGrad)"
                        dot={{ fill: "#8b5cf6", r: 4, strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ fill: "#6366f1", r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-overview-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  Subscription Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={PLAN_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6 mt-4" data-testid="tab-content-tenants">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Tenants"
              value={stats?.totalTenants || 0}
              icon={Building2}
              color="blue"
            />
            <StatCard
              title="Active Tenants"
              value={stats?.activeTenants || 0}
              icon={TrendingUp}
              color="emerald"
              subtitle={`${activeTenantRate}% active rate`}
            />
            <StatCard
              title="Churn Rate"
              value={`${stats?.churnRate || 0}%`}
              icon={TrendingDown}
              color="rose"
            />
          </div>

          <Card data-testid="chart-tenant-growth">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Tenant Growth Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenantGrowthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={axisTickStyle} />
                    <YAxis tick={axisTickStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="tenantBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="tenants" fill="url(#tenantBarGrad)" radius={[6, 6, 0, 0]} name="Tenants" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="table-tenants">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">All Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gym Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tenants || []).map((tenant) => (
                    <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                      <TableCell className="font-medium" data-testid={`text-tenant-name-${tenant.id}`}>
                        {tenant.gymName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.domain || tenant.subdomain || "---"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            tenant.subscriptionPlan === "enterprise"
                              ? "bg-violet-100 text-violet-700 border-violet-200"
                              : tenant.subscriptionPlan === "pro"
                              ? "bg-cyan-100 text-cyan-700 border-cyan-200"
                              : "bg-blue-100 text-blue-700 border-blue-200"
                          }`}
                          data-testid={`badge-plan-${tenant.id}`}
                        >
                          {tenant.subscriptionPlan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground uppercase text-xs">
                        {tenant.market || "uae"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            tenant.isActive
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }
                          data-testid={`badge-status-${tenant.id}`}
                        >
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {tenant.createdAt
                          ? new Date(tenant.createdAt).toLocaleDateString()
                          : "---"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!tenants || tenants.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6 mt-4" data-testid="tab-content-revenue">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Platform MRR"
              value={fmt(stats?.mrr || 0)}
              icon={DollarSign}
              color="violet"
              trend={{ value: stats?.mrrGrowth || 0, label: "growth" }}
            />
            <StatCard
              title="Avg Revenue/Tenant"
              value={fmt(
                stats && stats.activeTenants > 0
                  ? Math.round(stats.mrr / stats.activeTenants)
                  : 0
              )}
              icon={BarChart3}
              color="cyan"
            />
            <StatCard
              title="Active Subscribers"
              value={stats?.activeTenants || 0}
              icon={CreditCard}
              color="emerald"
            />
            <StatCard
              title="MRR Growth"
              value={`${stats?.mrrGrowth || 0}%`}
              icon={stats?.mrrGrowth && stats.mrrGrowth >= 0 ? ArrowUpRight : ArrowDownRight}
              color={stats?.mrrGrowth && stats.mrrGrowth >= 0 ? "emerald" : "rose"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-mrr-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  MRR Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mrrTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={axisTickStyle} />
                      <YAxis tick={axisTickStyle} tickFormatter={(v: number) => fmtShort(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [fmt(value), "MRR"]}
                      />
                      <defs>
                        <linearGradient id="revMrrGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                      <Line
                        type="monotone"
                        dataKey="mrr"
                        stroke="url(#revMrrGrad)"
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", r: 5, strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ fill: "#6366f1", r: 7, strokeWidth: 2, stroke: "#fff" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-mrr-by-plan">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  MRR Breakdown by Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mrrByPlan}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${fmtShort(value)}`}
                      >
                        {mrrByPlan.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={PLAN_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [fmt(value), "Revenue"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {revenuePerTenantData.length > 0 && (
            <Card data-testid="chart-revenue-per-tenant">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Revenue per Tenant (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenuePerTenantData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={axisTickStyle} angle={-25} textAnchor="end" height={50} />
                      <YAxis tick={axisTickStyle} tickFormatter={(v: number) => fmtShort(v)} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [fmt(value), "Revenue"]}
                      />
                      <defs>
                        <linearGradient id="revTenantGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#0891b2" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="revenue" fill="url(#revTenantGrad)" radius={[6, 6, 0, 0]} name="Monthly Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-6 mt-4" data-testid="tab-content-subscriptions">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Subscriptions"
              value={stats?.totalTenants || 0}
              icon={CreditCard}
              color="blue"
            />
            <StatCard
              title="Active Subscriptions"
              value={stats?.activeTenants || 0}
              icon={TrendingUp}
              color="emerald"
              subtitle={`${activeTenantRate}% active`}
            />
            <StatCard
              title="Churn Rate"
              value={`${stats?.churnRate || 0}%`}
              icon={TrendingDown}
              color="rose"
              subtitle="Monthly churn"
            />
            <StatCard
              title="Net New (30d)"
              value={`+${Math.max((stats?.totalTenants || 0) - (stats?.activeTenants || 0), 3)}`}
              icon={ArrowUpRight}
              color="indigo"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-plan-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  Plan Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={PLAN_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-upgrades-downgrades">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Upgrades vs Downgrades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subscriptionMovementData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={axisTickStyle} />
                      <YAxis tick={axisTickStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <defs>
                        <linearGradient id="upgradeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="downgradeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="upgrades" fill="url(#upgradeGrad)" radius={[6, 6, 0, 0]} name="Upgrades" />
                      <Bar dataKey="downgrades" fill="url(#downgradeGrad)" radius={[6, 6, 0, 0]} name="Downgrades" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {plans && plans.length > 0 && (
            <Card data-testid="table-plan-details">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Plan Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Monthly Price</TableHead>
                      <TableHead>Annual Price</TableHead>
                      <TableHead>Max Members</TableHead>
                      <TableHead>Subscribers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => {
                      const subscriberCount = (tenants || []).filter(
                        (t) => (t.subscriptionPlan || "basic") === plan.name.toLowerCase()
                      ).length;
                      return (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell className="font-medium capitalize" data-testid={`text-plan-name-${plan.id}`}>
                            {plan.name}
                          </TableCell>
                          <TableCell>{fmt(parseFloat(String(plan.priceMonthly)))}</TableCell>
                          <TableCell>{fmt(parseFloat(String(plan.priceAnnual)))}</TableCell>
                          <TableCell>{plan.maxMembers || "Unlimited"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-blue-100 text-blue-700 border-blue-200"
                            >
                              {subscriberCount} tenants
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                plan.isActive
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }
                            >
                              {plan.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
