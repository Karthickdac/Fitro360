import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  CreditCard, CheckCircle2, AlertCircle, AlertTriangle,
  Calendar, ExternalLink, Sparkles, Receipt,
} from "lucide-react";

interface BillingMe {
  tenant: {
    id: string;
    gymName: string;
    subscriptionPlan: string | null;
    subscriptionStatus: string;
    subscriptionInterval: "monthly" | "annual";
    currentPeriodEnd: string | null;
    gracePeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    isActive: boolean;
    hasCustomer: boolean;
    hasSubscription: boolean;
  };
  plans: Array<{
    id: string;
    name: string;
    priceMonthly: string;
    priceAnnual: string;
    features: string[];
    maxMembers: number | null;
    isPopular: boolean;
    isActive: boolean;
    synced: boolean;
  }>;
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  invoices: Array<{
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    status: string;
    created: number;
    periodStart: number;
    periodEnd: number;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  upcomingInvoice: { periodEnd: number; amount: number; currency: string } | null;
  stripeReady: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  trialing: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  canceled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  unpaid: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function formatMoney(cents: number, currency: string = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((cents || 0) / 100);
}

export default function BillingPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  const { data, isLoading } = useQuery<BillingMe>({ queryKey: ["/api/billing/me"] });

  useEffect(() => {
    if (data?.tenant.subscriptionInterval) setInterval(data.tenant.subscriptionInterval);
  }, [data?.tenant.subscriptionInterval]);

  // Check URL params for checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success") {
      toast({ title: "Subscription updated", description: "Your billing has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/me"] });
      window.history.replaceState({}, "", "/settings/billing");
    } else if (status === "canceled") {
      toast({ title: "Checkout canceled", description: "No changes were made.", variant: "destructive" });
      window.history.replaceState({}, "", "/settings/billing");
    }
  }, [toast]);

  const checkout = useMutation({
    mutationFn: async (vars: { planId: string; interval: "monthly" | "annual" }) => {
      const res = await apiRequest("POST", "/api/billing/checkout", vars);
      return await res.json();
    },
    onSuccess: (resp: any) => {
      if (resp?.url) window.location.href = resp.url;
    },
    onError: (e: any) => toast({ title: "Could not start checkout", description: e.message, variant: "destructive" }),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return await res.json();
    },
    onSuccess: (resp: any) => {
      if (resp?.url) window.location.href = resp.url;
    },
    onError: (e: any) => toast({ title: "Could not open billing portal", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="container mx-auto p-6">Failed to load billing.</div>;
  }

  const t = data.tenant;
  const status = t.subscriptionStatus;
  const isPastDue = status === "past_due";
  const isCanceled = status === "canceled";
  const hasActiveSub = t.hasSubscription && (status === "active" || status === "trialing" || status === "past_due");

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6" data-testid="page-billing">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription, payment method, and invoices.</p>
      </div>

      {!data.stripeReady && (
        <Alert variant="destructive" data-testid="alert-stripe-not-ready">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Billing temporarily unavailable</AlertTitle>
          <AlertDescription>Stripe is not yet connected by your platform admin. Please try again later.</AlertDescription>
        </Alert>
      )}

      {isPastDue && (
        <Alert variant="destructive" data-testid="alert-past-due">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            Your last payment did not go through. You have until{" "}
            <strong>{t.gracePeriodEndsAt ? format(new Date(t.gracePeriodEndsAt), "MMMM d, yyyy") : "soon"}</strong>{" "}
            to update your payment method before your account is suspended.
          </AlertDescription>
        </Alert>
      )}

      {t.cancelAtPeriodEnd && t.currentPeriodEnd && (
        <Alert data-testid="alert-canceling">
          <Calendar className="h-4 w-4" />
          <AlertTitle>Subscription will end</AlertTitle>
          <AlertDescription>
            Access continues until <strong>{format(new Date(t.currentPeriodEnd), "MMMM d, yyyy")}</strong>. You can resume from the billing portal.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-current-plan">
          <CardHeader className="pb-3">
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="flex items-center gap-2 capitalize" data-testid="text-current-plan">
              {t.subscriptionPlan || "—"}
              <Badge variant="outline" className={statusColors[status]} data-testid="badge-status">
                {status.replace("_", " ")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground capitalize" data-testid="text-current-interval">
            Billed {t.subscriptionInterval}
          </CardContent>
        </Card>

        <Card data-testid="card-payment-method">
          <CardHeader className="pb-3">
            <CardDescription>Payment method</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {data.paymentMethod ? (
                <span data-testid="text-payment-method">
                  {data.paymentMethod.brand?.toUpperCase()} •••• {data.paymentMethod.last4}
                </span>
              ) : (
                <span className="text-muted-foreground" data-testid="text-no-payment-method">No card on file</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.paymentMethod && (
              <p className="text-xs text-muted-foreground mb-3" data-testid="text-card-expiry">
                Expires {String(data.paymentMethod.expMonth).padStart(2, "0")}/{data.paymentMethod.expYear}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => portal.mutate()}
              disabled={portal.isPending || !t.hasCustomer || !data.stripeReady}
              data-testid="button-manage-payment"
            >
              {data.paymentMethod ? "Update card" : "Add payment method"}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-next-renewal">
          <CardHeader className="pb-3">
            <CardDescription>Next renewal</CardDescription>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span data-testid="text-next-renewal">
                {t.currentPeriodEnd ? format(new Date(t.currentPeriodEnd), "MMM d, yyyy") : "—"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingInvoice ? (
              <p className="text-sm text-muted-foreground" data-testid="text-upcoming-amount">
                {formatMoney(data.upcomingInvoice.amount, data.upcomingInvoice.currency)} due
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <div className="inline-flex bg-muted p-1 rounded-md">
              <button
                onClick={() => setInterval("monthly")}
                className={`px-3 py-1 text-sm rounded ${interval === "monthly" ? "bg-background shadow-sm" : ""}`}
                data-testid="button-interval-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval("annual")}
                className={`px-3 py-1 text-sm rounded ${interval === "annual" ? "bg-background shadow-sm" : ""}`}
                data-testid="button-interval-annual"
              >
                Annual <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">save</span>
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.plans.filter(p => p.isActive).map((p) => {
              const isCurrent = t.subscriptionPlan?.toLowerCase() === p.name.toLowerCase() && t.subscriptionInterval === interval && hasActiveSub;
              const price = interval === "annual" ? p.priceAnnual : p.priceMonthly;
              const monthlyEquiv = interval === "annual" ? Number(p.priceAnnual) / 12 : Number(p.priceMonthly);
              return (
                <Card
                  key={p.id}
                  className={`relative ${p.isPopular ? "border-primary shadow-md" : ""}`}
                  data-testid={`card-plan-${p.id}`}
                >
                  {p.isPopular && (
                    <Badge className="absolute -top-2 left-4 bg-primary" data-testid={`badge-popular-${p.id}`}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle data-testid={`text-plan-name-${p.id}`}>{p.name}</CardTitle>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold" data-testid={`text-plan-price-${p.id}`}>${price}</span>
                      <span className="text-sm text-muted-foreground">/{interval === "annual" ? "yr" : "mo"}</span>
                    </div>
                    {interval === "annual" && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-plan-monthly-equiv-${p.id}`}>
                        ≈ ${monthlyEquiv.toFixed(2)}/mo
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {p.maxMembers && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-plan-members-${p.id}`}>
                        Up to {p.maxMembers.toLocaleString()} members
                      </p>
                    )}
                    {p.features?.length > 0 && (
                      <ul className="space-y-1.5 text-sm">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2" data-testid={`text-plan-feature-${p.id}-${i}`}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : p.isPopular ? "default" : "secondary"}
                      disabled={isCurrent || checkout.isPending || !data.stripeReady || !p.synced}
                      onClick={() => {
                        if (hasActiveSub && t.hasCustomer) {
                          // Existing subscriber → redirect to portal to change plan/interval
                          portal.mutate();
                        } else {
                          checkout.mutate({ planId: p.id, interval });
                        }
                      }}
                      data-testid={`button-select-plan-${p.id}`}
                    >
                      {isCurrent
                        ? "Current plan"
                        : !p.synced
                        ? "Not available yet"
                        : hasActiveSub
                        ? "Change plan"
                        : "Subscribe"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice history
              </CardTitle>
              <CardDescription>Download or view receipts for your subscription payments.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-invoices">
                  No invoices yet. They will appear here after your first payment.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.map((inv) => (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell data-testid={`text-invoice-date-${inv.id}`}>
                          {format(new Date(inv.created * 1000), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-invoice-number-${inv.id}`}>
                          {inv.number || inv.id}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" data-testid={`text-invoice-period-${inv.id}`}>
                          {format(new Date(inv.periodStart * 1000), "MMM d")} – {format(new Date(inv.periodEnd * 1000), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              inv.status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : inv.status === "open"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : ""
                            }
                            data-testid={`badge-invoice-status-${inv.id}`}
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-invoice-amount-${inv.id}`}>
                          {formatMoney(inv.amount, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {inv.hostedInvoiceUrl && (
                              <Button asChild size="sm" variant="ghost" data-testid={`button-view-invoice-${inv.id}`}>
                                <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                  View
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </Button>
                            )}
                            {inv.invoicePdf && (
                              <Button asChild size="sm" variant="ghost" data-testid={`button-pdf-invoice-${inv.id}`}>
                                <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer">PDF</a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {t.hasCustomer && data.stripeReady && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending} data-testid="button-open-portal">
            Open billing portal
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
