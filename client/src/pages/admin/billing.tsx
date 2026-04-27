import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DollarSign, Users, AlertTriangle, CheckCircle2, Clock, Search } from "lucide-react";

interface TenantBilling {
  id: string;
  gymName: string;
  email: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  subscriptionInterval: string;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isActive: boolean;
  monthlyRevenue: number;
}

interface BillingResponse {
  tenants: TenantBilling[];
  mrr: number;
  counts: Record<string, number>;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trialing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  canceled: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  unpaid: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  incomplete: "bg-muted-foreground/10 text-muted-foreground",
  suspended: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

export default function AdminBillingPage() {
  const { data, isLoading } = useQuery<BillingResponse>({ queryKey: ["/api/admin/billing/tenants"] });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!data?.tenants) return [];
    const q = search.trim().toLowerCase();
    return data.tenants.filter((t) => {
      const matchesQ = !q || t.gymName.toLowerCase().includes(q) || (t.email || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || t.subscriptionStatus === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const stats = useMemo(() => {
    const active = data?.counts?.active || 0;
    const trialing = data?.counts?.trialing || 0;
    const pastDue = data?.counts?.past_due || 0;
    const arr = (data?.mrr || 0) * 12;
    return { active, trialing, pastDue, mrr: data?.mrr || 0, arr };
  }, [data]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl" data-testid="page-admin-billing">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Tenant Billing</h1>
        <p className="text-muted-foreground mt-1">Subscription status, MRR, and payment health across all gyms.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-stat-mrr">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">MRR</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold" data-testid="text-mrr">{formatMoney(stats.mrr)}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">ARR ≈ {formatMoney(stats.arr)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-active">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Active</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold" data-testid="text-active-count">{stats.active}</div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-trialing">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Trialing</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold" data-testid="text-trialing-count">{stats.trialing}</div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-past-due">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Past Due</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold" data-testid="text-past-due-count">{stats.pastDue}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All tenants
              </CardTitle>
              <CardDescription>Click a row to inspect; failed payments enter a 3-day grace period.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gym or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-tenants"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-input bg-background rounded-md px-3 py-2 text-sm"
                data-testid="select-status-filter"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center" data-testid="text-no-tenants">No tenants match your filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Grace ends</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} data-testid={`row-tenant-${t.id}`}>
                    <TableCell>
                      <div className="font-medium" data-testid={`text-tenant-name-${t.id}`}>{t.gymName}</div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-tenant-email-${t.id}`}>{t.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium capitalize" data-testid={`text-tenant-plan-${t.id}`}>{t.subscriptionPlan || "—"}</div>
                      <div className="text-xs text-muted-foreground capitalize">{t.subscriptionInterval}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[t.subscriptionStatus] || ""}
                        data-testid={`badge-tenant-status-${t.id}`}
                      >
                        {t.subscriptionStatus.replace("_", " ")}
                      </Badge>
                      {t.cancelAtPeriodEnd && (
                        <Badge variant="outline" className="ml-1 text-xs" data-testid={`badge-cancel-${t.id}`}>Canceling</Badge>
                      )}
                      {!t.isActive && (
                        <Badge variant="destructive" className="ml-1 text-xs" data-testid={`badge-suspended-${t.id}`}>Suspended</Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-tenant-renew-${t.id}`}>
                      {t.currentPeriodEnd ? format(new Date(t.currentPeriodEnd), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell data-testid={`text-tenant-grace-${t.id}`}>
                      {t.gracePeriodEndsAt ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {format(new Date(t.gracePeriodEndsAt), "MMM d, yyyy")}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-tenant-mrr-${t.id}`}>
                      {formatMoney(t.monthlyRevenue || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
