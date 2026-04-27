import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink, CreditCard } from "lucide-react";

interface PlanSync {
  id: string;
  name: string;
  priceMonthly: string;
  priceAnnual: string;
  isActive: boolean;
  synced: boolean;
  stripeProductId: string | null;
}

interface StripeStatus {
  ready: boolean;
  mode: "test" | "live" | "unknown";
  accountId: string | null;
  displayName: string | null;
  webhookUrl: string | null;
  planSync: PlanSync[];
}

export default function AdminStripeSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<StripeStatus>({ queryKey: ["/api/admin/stripe/status"] });

  const syncAll = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/stripe/sync-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Synced", description: "All plans pushed to Stripe." });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const syncOne = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/plans/${id}/sync-stripe`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe/status"] });
      toast({ title: "Synced" });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const copy = (val: string | null | undefined, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl" data-testid="page-stripe-settings">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Stripe Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Stripe connection, webhook, and plan synchronization for SaaS billing.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data?.ready ? (
        <Alert variant="destructive" data-testid="alert-stripe-not-ready">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Stripe is not connected</AlertTitle>
          <AlertDescription>
            The Stripe connection has not been configured for this workspace. Please contact your developer to connect Stripe via the Replit integration.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card data-testid="card-stripe-connection">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Connection active
                  </CardTitle>
                  <CardDescription>Stripe is connected and ready to process payments.</CardDescription>
                </div>
                <Badge
                  variant={data.mode === "live" ? "destructive" : "secondary"}
                  data-testid={`badge-stripe-mode`}
                  className="uppercase"
                >
                  {data.mode === "live" ? "LIVE MODE" : data.mode === "test" ? "TEST MODE" : "UNKNOWN"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Account</div>
                <div className="font-medium" data-testid="text-stripe-account-name">{data.displayName || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Account ID</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="text-stripe-account-id">{data.accountId || "—"}</code>
                  {data.accountId && (
                    <Button size="icon" variant="ghost" onClick={() => copy(data.accountId, "Account ID")} data-testid="button-copy-account-id">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Webhook endpoint (managed automatically)</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-stripe-webhook-url">
                    {data.webhookUrl || "—"}
                  </code>
                  {data.webhookUrl && (
                    <Button size="icon" variant="ghost" onClick={() => copy(data.webhookUrl, "Webhook URL")} data-testid="button-copy-webhook-url">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This webhook is created and signed automatically. Subscription, invoice, and payment events update tenant billing in real time.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-plan-sync">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Plan synchronization
                  </CardTitle>
                  <CardDescription>
                    Pricing on the Plans page is mirrored into Stripe products and prices automatically. Use sync if a plan is out of date.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => syncAll.mutate()}
                  disabled={syncAll.isPending}
                  data-testid="button-sync-all-plans"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncAll.isPending ? "animate-spin" : ""}`} />
                  Sync all plans
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.planSync.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-plans">
                  No subscription plans defined yet. Create plans on the Plans page first.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Annual</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stripe Product</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.planSync.map((p) => (
                      <TableRow key={p.id} data-testid={`row-plan-${p.id}`}>
                        <TableCell className="font-medium" data-testid={`text-plan-name-${p.id}`}>{p.name}</TableCell>
                        <TableCell data-testid={`text-plan-monthly-${p.id}`}>${p.priceMonthly}</TableCell>
                        <TableCell data-testid={`text-plan-annual-${p.id}`}>${p.priceAnnual}</TableCell>
                        <TableCell>
                          {p.synced ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" data-testid={`badge-plan-synced-${p.id}`}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="outline" data-testid={`badge-plan-not-synced-${p.id}`}>Not synced</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-0.5 rounded" data-testid={`text-plan-product-${p.id}`}>
                            {p.stripeProductId ? `${p.stripeProductId.slice(0, 14)}…` : "—"}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncOne.mutate(p.id)}
                            disabled={syncOne.isPending}
                            data-testid={`button-sync-plan-${p.id}`}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Sync
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-stripe-resources">
            <CardHeader>
              <CardTitle className="text-base">Stripe Dashboard</CardTitle>
              <CardDescription>Manage payouts, refunds, tax, and disputes directly on Stripe.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" data-testid="button-open-stripe-dashboard">
                <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                  Open Stripe Dashboard
                  <ExternalLink className="h-3.5 w-3.5 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
