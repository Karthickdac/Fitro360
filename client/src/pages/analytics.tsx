import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, TrendingUp, Users, DollarSign, Download, Package } from "lucide-react";
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

const CHART_COLORS = [
  "hsl(217, 91%, 35%)",
  "hsl(173, 58%, 39%)",
  "hsl(32, 95%, 44%)",
  "hsl(280, 65%, 45%)",
  "hsl(340, 75%, 42%)",
];

interface DashboardData {
  monthlyData: { month: string; members: number; revenue: number; attendance: number }[];
  membershipDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
  totalRevenue: number;
  inventoryValue: number;
  totalMembers: number;
  activeMembers: number;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
  color: "hsl(var(--foreground))",
};

const axisTickStyle = { fill: "hsl(var(--muted-foreground))" };

export default function AnalyticsPage() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const handleExport = async (type: string) => {
    try {
      const res = await fetch(`/api/analytics/export?type=${type}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: `${type} data has been downloaded.` });
    } catch {
      toast({ title: "Export failed", description: "Could not download the export file.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="analytics-loading">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const monthlyData = data?.monthlyData || [];
  const membershipDistribution = data?.membershipDistribution || [];
  const statusDistribution = data?.statusDistribution || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-analytics">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-analytics-title">
          Analytics & Reports
        </h1>
        <p className="text-muted-foreground mt-1">Comprehensive overview of your gym performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="analytics-stats-row">
        <StatCard
          title="Total Members"
          value={data?.totalMembers || 0}
          icon={Users}
        />
        <StatCard
          title="Active Members"
          value={data?.activeMembers || 0}
          icon={TrendingUp}
          subtitle={`${data?.totalMembers ? Math.round((data.activeMembers / data.totalMembers) * 100) : 0}% of total`}
        />
        <StatCard
          title="Total Revenue"
          value={`AED ${(data?.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title="Inventory Value"
          value={`AED ${(data?.inventoryValue || 0).toLocaleString()}`}
          icon={Package}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="chart-member-growth">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Member Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={axisTickStyle} />
                  <YAxis className="text-xs" tick={axisTickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="members"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Members"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-revenue-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={axisTickStyle} />
                  <YAxis className="text-xs" tick={axisTickStyle} tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`AED ${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-attendance-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              <Users className="h-4 w-4 text-muted-foreground" />
              Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={axisTickStyle} />
                  <YAxis className="text-xs" tick={axisTickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="attendance"
                    stroke={CHART_COLORS[2]}
                    fill={CHART_COLORS[2]}
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="Attendance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-membership-distribution">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Membership Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {membershipDistribution.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-status-distribution">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Member Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusDistribution.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="export-section">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              <Download className="h-4 w-4 text-muted-foreground" />
              Export Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Download CSV exports for your records.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleExport("members")}
                data-testid="button-export-members"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Members
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("attendance")}
                data-testid="button-export-attendance"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("equipment")}
                data-testid="button-export-equipment"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Equipment
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("invoices")}
                data-testid="button-export-invoices"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}