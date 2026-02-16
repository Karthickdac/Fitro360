import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, DollarSign, TrendingUp, CreditCard, Banknote, Smartphone, Building2, Receipt } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StatCard } from "@/components/stat-card";
import type { PaymentRecord, Member, Invoice } from "@shared/schema";

const paymentSchema = z.object({
  memberId: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  method: z.string().min(1, "Payment method is required"),
  description: z.string().optional(),
  invoiceId: z.string().optional(),
  currency: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

const methodConfig: Record<string, { label: string; icon: typeof Banknote; className: string }> = {
  cash: { label: "Cash", icon: Banknote, className: "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" },
  card: { label: "Card", icon: CreditCard, className: "bg-blue-600 text-white no-default-hover-elevate no-default-active-elevate" },
  upi: { label: "UPI", icon: Smartphone, className: "bg-purple-600 text-white no-default-hover-elevate no-default-active-elevate" },
  bank_transfer: { label: "Bank Transfer", icon: Building2, className: "bg-orange-600 text-white no-default-hover-elevate no-default-active-elevate" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; className: string }> = {
  completed: { label: "Completed", variant: "default", className: "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" },
  pending: { label: "Pending", variant: "default", className: "bg-yellow-600 text-white no-default-hover-elevate no-default-active-elevate" },
  failed: { label: "Failed", variant: "destructive", className: "" },
  refunded: { label: "Refunded", variant: "default", className: "bg-orange-600 text-white no-default-hover-elevate no-default-active-elevate" },
};

export default function PaymentsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: payments, isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments"],
  });

  const { data: membersList } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const { data: invoicesList } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      memberId: "",
      amount: "",
      method: "",
      description: "",
      invoiceId: "",
      currency: "AED",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      const payload: Record<string, unknown> = {
        amount: data.amount,
        method: data.method,
        description: data.description,
        currency: data.currency || "AED",
      };
      if (data.memberId) payload.memberId = data.memberId;
      if (data.invoiceId) payload.invoiceId = data.invoiceId;
      const res = await apiRequest("POST", "/api/payments", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment recorded successfully" });
      form.reset({ memberId: "", amount: "", method: "", description: "", invoiceId: "", currency: "AED" });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to record payment", description: error.message, variant: "destructive" });
    },
  });

  const items = payments || [];
  const membersMap = new Map((membersList || []).map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  const invoicesMap = new Map((invoicesList || []).map((inv) => [inv.id, inv.invoiceNumber]));

  const totalRevenue = items.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

  const now = new Date();
  const thisMonthPayments = items.filter((p) => {
    if (!p.createdAt) return false;
    const d = new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  const avgPayment = items.length > 0 ? totalRevenue / items.length : 0;

  return (
    <div className="p-6 space-y-6" data-testid="page-payments">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">Track revenue and manage payment records</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-record-payment">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-member">
                            <SelectValue placeholder="Select member (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(membersList || []).map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-payment-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Payment description" {...field} data-testid="input-payment-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-invoice">
                            <SelectValue placeholder="Link to invoice (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(invoicesList || []).map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber} — AED {parseFloat(inv.total || "0").toFixed(2)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {createMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Revenue" value={`AED ${totalRevenue.toFixed(2)}`} icon={DollarSign} />
          <StatCard title="This Month" value={`AED ${monthRevenue.toFixed(2)}`} icon={TrendingUp} />
          <StatCard title="Total Payments" value={items.length} icon={Receipt} />
          <StatCard title="Average Payment" value={`AED ${avgPayment.toFixed(2)}`} icon={CreditCard} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No payments yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Get started by recording your first payment
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Invoice #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((payment) => {
                  const sCfg = statusConfig[payment.status] || statusConfig.completed;
                  const mCfg = methodConfig[payment.method] || methodConfig.cash;
                  const MethodIcon = mCfg.icon;
                  return (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-payment-date-${payment.id}`}>
                        {payment.createdAt ? format(new Date(payment.createdAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium text-sm" data-testid={`text-member-name-${payment.id}`}>
                        {payment.memberId ? membersMap.get(payment.memberId) || "Unknown" : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium" data-testid={`text-payment-amount-${payment.id}`}>
                        AED {parseFloat(payment.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className={mCfg.className} data-testid={`badge-method-${payment.id}`}>
                          <MethodIcon className="h-3 w-3 mr-1" />
                          {mCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sCfg.variant} className={sCfg.className} data-testid={`badge-payment-status-${payment.id}`}>
                          {sCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                        {payment.description || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {payment.invoiceId ? invoicesMap.get(payment.invoiceId) || payment.invoiceId : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
