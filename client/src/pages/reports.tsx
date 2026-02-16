import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarket } from "@/hooks/use-market";
import { useToast } from "@/hooks/use-toast";
import {
  Users, DollarSign, TrendingUp, AlertTriangle, Package,
  Download, CreditCard, Banknote, Smartphone, Building2,
  ClipboardList, Wrench, Clock, Activity, BarChart3,
  UserCheck, Snowflake, UserX, Dumbbell, Scale,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, Legend,
} from "recharts";
import { format } from "date-fns";
import type { Member, PaymentRecord, Equipment, Invoice, Attendance, EquipmentMaintenance } from "@shared/schema";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(32, 95%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(190, 90%, 45%)",
  "hsl(230, 70%, 55%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
  color: "hsl(var(--foreground))",
};

const axisTickStyle = { fill: "hsl(var(--muted-foreground))" };

const statusBadgeColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  expiring: "bg-amber-100 text-amber-700 border-amber-200",
  expired: "bg-red-100 text-red-700 border-red-200",
  frozen: "bg-sky-100 text-sky-700 border-sky-200",
};

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  memberGrowth: number;
}

export default function ReportsPage() {
  const { fmt, fmtShort } = useMarket();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });
  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });
  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments"],
  });
  const { data: equipmentList, isLoading: equipmentLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });
  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", `?date=${format(new Date(), "yyyy-MM-dd")}`],
  });
  const { data: maintenance, isLoading: maintenanceLoading } = useQuery<EquipmentMaintenance[]>({
    queryKey: ["/api/maintenance"],
  });

  const handleExport = async (type: string) => {
    try {
      const res = await fetch(`/api/analytics/export?type=${type}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: `${type} report has been downloaded.` });
    } catch {
      toast({ title: "Export failed", description: "Could not download the export file.", variant: "destructive" });
    }
  };

  const allMembers = members || [];
  const allPayments = payments || [];
  const allEquipment = equipmentList || [];
  const allInvoices = invoices || [];
  const allAttendance = attendanceData || [];
  const allMaintenance = maintenance || [];

  const activeCount = allMembers.filter((m) => m.status === "active").length;
  const expiredCount = allMembers.filter((m) => m.status === "expired").length;
  const frozenCount = allMembers.filter((m) => m.status === "frozen").length;

  const totalRevenue = allPayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
  const now = new Date();
  const thisMonthPayments = allPayments.filter((p) => {
    if (!p.createdAt) return false;
    const d = new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonthPayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);

  const methodBreakdown = allPayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + parseFloat(p.amount || "0");
    return acc;
  }, {});
  const methodChartData = Object.entries(methodBreakdown).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "), value }));

  const membershipBreakdown = allMembers.reduce<Record<string, number>>((acc, m) => {
    const type = m.membershipType || "monthly";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const membershipChartData = Object.entries(membershipBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const bmiRanges = { Underweight: 0, Normal: 0, Overweight: 0, Obese: 0 };
  allMembers.forEach((m) => {
    const bmi = parseFloat(m.bmi || "0");
    if (bmi <= 0) return;
    if (bmi < 18.5) bmiRanges.Underweight++;
    else if (bmi < 25) bmiRanges.Normal++;
    else if (bmi < 30) bmiRanges.Overweight++;
    else bmiRanges.Obese++;
  });
  const bmiChartData = Object.entries(bmiRanges).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const trainersAssigned = allMembers.filter((m) => m.trainerId).length;
  const trainersUnassigned = allMembers.length - trainersAssigned;

  const monthlyRevData: Record<string, number> = {};
  allPayments.forEach((p) => {
    if (!p.createdAt) return;
    const d = new Date(p.createdAt);
    const key = format(d, "MMM yyyy");
    monthlyRevData[key] = (monthlyRevData[key] || 0) + parseFloat(p.amount || "0");
  });
  const monthlyRevenueChart = Object.entries(monthlyRevData).slice(-6).map(([month, revenue]) => ({ month, revenue }));

  const pendingInvoices = allInvoices.filter((i) => i.status === "pending");
  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const outstandingAmount = pendingInvoices.reduce((s, i) => s + parseFloat(i.total || "0"), 0);
  const collectionRate = allInvoices.length > 0 ? Math.round((paidInvoices.length / allInvoices.length) * 100) : 0;

  const inventoryValue = allEquipment.reduce((s, e) => s + (e.quantity || 0) * parseFloat(e.costPrice || "0"), 0);
  const lowStockItems = allEquipment.filter((e) => (e.quantity || 0) <= (e.minStock || 5));
  const maintenanceCosts = allMaintenance.reduce((s, m) => s + parseFloat(m.cost || "0"), 0);
  const upcomingMaintenance = allMaintenance.filter((m) => m.status === "scheduled");

  const hourlyCheckins: Record<number, number> = {};
  allAttendance.forEach((a) => {
    if (!a.checkInTime) return;
    const h = new Date(a.checkInTime).getHours();
    hourlyCheckins[h] = (hourlyCheckins[h] || 0) + 1;
  });
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    checkins: hourlyCheckins[i] || 0,
  })).filter((d) => d.checkins > 0 || (parseInt(d.hour) >= 5 && parseInt(d.hour) <= 23));

  const avgSessionMin = (() => {
    const durations = allAttendance
      .filter((a) => a.checkInTime && a.checkOutTime)
      .map((a) => (new Date(a.checkOutTime!).getTime() - new Date(a.checkInTime!).getTime()) / 60000);
    return durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;
  })();

  const isLoading = statsLoading || membersLoading || paymentsLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="reports-loading">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-reports">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground mt-1">Comprehensive reporting hub for your gym operations.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" data-testid="reports-tabs">
        <TabsList className="flex flex-wrap" data-testid="reports-tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">Attendance</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6" data-testid="tab-content-overview">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Total Members" value={stats?.totalMembers || allMembers.length} icon={Users} color="blue"
              trend={{ value: stats?.memberGrowth || 0, label: "vs last month" }} />
            <StatCard title="Active Members" value={activeCount} icon={UserCheck} color="emerald"
              subtitle={`${allMembers.length > 0 ? Math.round((activeCount / allMembers.length) * 100) : 0}% of total`} />
            <StatCard title="Monthly Revenue" value={fmt(stats?.monthlyRevenue || monthRevenue)} icon={DollarSign} color="violet"
              trend={{ value: stats?.revenueGrowth || 0, label: "vs last month" }} />
            <StatCard title="Expiring Soon" value={stats?.expiringMembers || 0} icon={AlertTriangle} color="amber"
              subtitle="Within 7 days" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="overview-financial-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span className="text-sm font-semibold" data-testid="text-total-revenue">{fmt(totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    <span className="text-sm font-semibold" data-testid="text-month-revenue">{fmt(monthRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Outstanding Invoices</span>
                    <span className="text-sm font-semibold" data-testid="text-outstanding">{fmt(outstandingAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Collection Rate</span>
                    <Badge variant="outline" className={collectionRate >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                      {collectionRate}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Inventory Value</span>
                    <span className="text-sm font-semibold">{fmt(inventoryValue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="overview-membership-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Membership Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: "Active", value: activeCount },
                        { name: "Expired", value: expiredCount },
                        { name: "Frozen", value: frozenCount },
                        { name: "Other", value: Math.max(0, allMembers.length - activeCount - expiredCount - frozenCount) },
                      ].filter((d) => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {[CHART_COLORS[1], CHART_COLORS[4], CHART_COLORS[5], CHART_COLORS[2]].map((color, i) => (
                          <Cell key={i} fill={color} />
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

          <div className="flex justify-end gap-3 flex-wrap">
            <Button variant="outline" onClick={() => handleExport("members")} data-testid="button-export-overview-members">
              <Download className="mr-2 h-4 w-4" /> Export Members
            </Button>
            <Button variant="outline" onClick={() => handleExport("invoices")} data-testid="button-export-overview-invoices">
              <Download className="mr-2 h-4 w-4" /> Export Invoices
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6" data-testid="tab-content-members">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Total Members" value={allMembers.length} icon={Users} color="blue" />
            <StatCard title="Active" value={activeCount} icon={UserCheck} color="emerald" />
            <StatCard title="Expired" value={expiredCount} icon={UserX} color="rose" />
            <StatCard title="Frozen" value={frozenCount} icon={Snowflake} color="cyan" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-membership-type">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Membership Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={membershipChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {membershipChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-bmi-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  BMI Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bmiChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bmiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(280, 65%, 60%)" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(280, 65%, 40%)" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={axisTickStyle} />
                      <YAxis className="text-xs" tick={axisTickStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="url(#bmiGradient)" radius={[6, 6, 0, 0]} name="Members" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatCard title="With Trainer" value={trainersAssigned} icon={Dumbbell} color="indigo"
              subtitle={`${allMembers.length > 0 ? Math.round((trainersAssigned / allMembers.length) * 100) : 0}% assigned`} />
            <StatCard title="Without Trainer" value={trainersUnassigned} icon={Users} color="amber"
              subtitle="Unassigned members" />
          </div>

          <Card data-testid="table-members-report">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Member Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">BMI</TableHead>
                    <TableHead className="hidden lg:table-cell">Trainer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMembers.slice(0, 20).map((m) => (
                    <TableRow key={m.id} data-testid={`row-member-report-${m.id}`}>
                      <TableCell className="font-medium text-sm">{m.firstName} {m.lastName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 no-default-hover-elevate no-default-active-elevate">
                          {m.membershipType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${statusBadgeColors[m.status] || "bg-gray-100 text-gray-700 border-gray-200"} no-default-hover-elevate no-default-active-elevate`}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {m.bmi ? parseFloat(m.bmi).toFixed(1) : "N/A"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {m.trainerId ? "Assigned" : "None"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleExport("members")} data-testid="button-export-members-report">
              <Download className="mr-2 h-4 w-4" /> Export Members Report
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6 mt-6" data-testid="tab-content-financial">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={fmt(totalRevenue)} icon={DollarSign} color="blue" />
            <StatCard title="This Month" value={fmt(monthRevenue)} icon={TrendingUp} color="emerald" />
            <StatCard title="Outstanding" value={fmt(outstandingAmount)} icon={ClipboardList} color="rose"
              subtitle={`${pendingInvoices.length} pending invoices`} />
            <StatCard title="Collection Rate" value={`${collectionRate}%`} icon={CreditCard} color="violet"
              subtitle={`${paidInvoices.length} of ${allInvoices.length} paid`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-revenue-by-method">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Revenue by Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={methodChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {methodChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value), "Revenue"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-monthly-revenue-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Monthly Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenueChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={axisTickStyle} />
                      <YAxis className="text-xs" tick={axisTickStyle} tickFormatter={(v: number) => fmtShort(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value), "Revenue"]} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 39%)" fill="url(#revAreaGradient)" strokeWidth={2} name="Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="table-invoices-report">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allInvoices.slice(0, 15).map((inv) => (
                    <TableRow key={inv.id} data-testid={`row-invoice-report-${inv.id}`}>
                      <TableCell className="font-medium text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm capitalize">{inv.type}</TableCell>
                      <TableCell className="text-sm font-medium">{fmt(inv.total || "0")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize no-default-hover-elevate no-default-active-elevate ${
                          inv.status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          inv.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-red-100 text-red-700 border-red-200"
                        }`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {inv.createdAt ? format(new Date(inv.createdAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 flex-wrap">
            <Button variant="outline" onClick={() => handleExport("invoices")} data-testid="button-export-financial-invoices">
              <Download className="mr-2 h-4 w-4" /> Export Invoices
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6 mt-6" data-testid="tab-content-attendance">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Today's Check-ins" value={allAttendance.length} icon={Activity} color="blue" />
            <StatCard title="Avg Session" value={avgSessionMin > 0 ? `${avgSessionMin} min` : "N/A"} icon={Clock} color="emerald" />
            <StatCard title="Peak Hour" value={
              Object.keys(hourlyCheckins).length > 0
                ? `${Object.entries(hourlyCheckins).sort((a, b) => b[1] - a[1])[0][0].padStart(2, "0")}:00`
                : "N/A"
            } icon={TrendingUp} color="violet" />
            <StatCard title="Active Members" value={activeCount} icon={UserCheck} color="amber"
              subtitle="Total active members" />
          </div>

          <Card data-testid="chart-hourly-checkins">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Check-in Pattern (Today)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="checkinGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(250, 80%, 60%)" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" className="text-xs" tick={axisTickStyle} />
                    <YAxis className="text-xs" tick={axisTickStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="checkins" fill="url(#checkinGradient)" radius={[6, 6, 0, 0]} name="Check-ins" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="table-attendance-report">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Today's Attendance Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {allAttendance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                    <Activity className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No check-ins recorded today</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member ID</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAttendance.slice(0, 20).map((a) => (
                      <TableRow key={a.id} data-testid={`row-attendance-${a.id}`}>
                        <TableCell className="text-sm font-medium">{a.memberId}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.checkInTime ? format(new Date(a.checkInTime), "h:mm a") : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.checkOutTime ? format(new Date(a.checkOutTime), "h:mm a") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 capitalize no-default-hover-elevate no-default-active-elevate">
                            {a.method || "manual"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleExport("attendance")} data-testid="button-export-attendance-report">
              <Download className="mr-2 h-4 w-4" /> Export Attendance
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-6 mt-6" data-testid="tab-content-equipment">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Inventory Value" value={fmt(inventoryValue)} icon={Package} color="blue" />
            <StatCard title="Low Stock Items" value={lowStockItems.length} icon={AlertTriangle} color="rose"
              subtitle="Below minimum stock" />
            <StatCard title="Maintenance Costs" value={fmt(maintenanceCosts)} icon={Wrench} color="amber" />
            <StatCard title="Upcoming Tasks" value={upcomingMaintenance.length} icon={ClipboardList} color="indigo"
              subtitle="Scheduled maintenance" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="table-low-stock">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Low Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {lowStockItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-muted-foreground">All items are well stocked</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Min</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((e) => (
                        <TableRow key={e.id} data-testid={`row-lowstock-${e.id}`}>
                          <TableCell className="font-medium text-sm">{e.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 no-default-hover-elevate no-default-active-elevate">
                              {e.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.minStock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card data-testid="table-upcoming-maintenance">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Upcoming Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {upcomingMaintenance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-muted-foreground">No scheduled maintenance</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingMaintenance.slice(0, 10).map((m) => (
                        <TableRow key={m.id} data-testid={`row-maintenance-${m.id}`}>
                          <TableCell className="font-medium text-sm">{m.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 capitalize no-default-hover-elevate no-default-active-elevate">
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.scheduledDate ? format(new Date(m.scheduledDate), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{m.cost ? fmt(m.cost) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleExport("equipment")} data-testid="button-export-equipment-report">
              <Download className="mr-2 h-4 w-4" /> Export Equipment
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
