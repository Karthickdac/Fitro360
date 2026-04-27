import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ArrowRightLeft, Check, X, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import type { Member } from "@shared/schema";

type Transfer = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  membershipPlanId: string | null;
  transferDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  fee: string | null;
  remainingDays: number | null;
  notes: string | null;
  createdAt: string;
};

const formSchema = z.object({
  fromMemberId: z.string().min(1, "Source member required"),
  toMemberId: z.string().min(1, "Destination member required"),
  reason: z.string().optional(),
  fee: z.string().optional(),
  notes: z.string().optional(),
});

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

export default function MembershipTransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const canApprove = user?.role === "gym_owner" || user?.role === "platform_admin";

  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/membership-transfers"],
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const memberMap = new Map((members || []).map(m => [m.id, m]));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fromMemberId: "", toMemberId: "", reason: "", fee: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
      );
      const res = await apiRequest("POST", "/api/membership-transfers", cleaned);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-transfers"] });
      toast({ title: "Transfer requested", description: canApprove ? "Pending your approval" : "Awaiting gym owner approval" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/membership-transfers/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Transfer approved", description: "Membership has been transferred" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/membership-transfers/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-transfers"] });
      toast({ title: "Transfer rejected" });
    },
  });

  const pending = (transfers || []).filter(t => t.status === "pending");
  const completed = (transfers || []).filter(t => t.status !== "pending");

  return (
    <div className="p-6 space-y-6" data-testid="page-transfers">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Member Transfers</h1>
          <p className="text-muted-foreground mt-1">Transfer remaining membership balance between members (with approval)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-transfer">
              <Plus className="h-4 w-4 mr-2" />
              New Transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request Membership Transfer</DialogTitle>
              <DialogDescription>Move the remaining membership days from one member to another. Requires gym owner approval.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="fromMemberId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Member *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-from"><SelectValue placeholder="Select source member" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(members || []).filter(m => m.status === "active" || m.status === "frozen").map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="toMemberId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Member *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-to"><SelectValue placeholder="Select destination member" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(members || []).filter(m => m.id !== form.watch("fromMemberId")).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Input placeholder="e.g. relocation, refund swap" {...field} data-testid="input-reason" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="fee" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Fee (optional)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-fee" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Input placeholder="Internal notes" {...field} data-testid="input-notes" /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending ? "Submitting..." : "Request Transfer"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Pending</p>
          <p className="text-2xl font-bold mt-1 text-amber-600" data-testid="stat-pending">{pending.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Approved</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600" data-testid="stat-approved">{(transfers || []).filter(t => t.status === "approved").length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1"><X className="h-3 w-3 text-red-500" /> Rejected</p>
          <p className="text-2xl font-bold mt-1 text-red-600" data-testid="stat-rejected">{(transfers || []).filter(t => t.status === "rejected").length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (transfers || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No transfers yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">Request a transfer when a member wants to move their unused days to someone else.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...pending, ...completed].map(t => {
                  const from = memberMap.get(t.fromMemberId);
                  const to = memberMap.get(t.toMemberId);
                  return (
                    <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                      <TableCell>
                        <p className="font-semibold text-sm">{from ? `${from.firstName} ${from.lastName}` : "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{from?.email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">{to ? `${to.firstName} ${to.lastName}` : "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{to?.email}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{format(new Date(t.transferDate), "MMM d, yyyy")}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{t.reason || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-medium">{t.remainingDays ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${statusColors[t.status]}`}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === "pending" && canApprove && (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-emerald-600 border-emerald-200" onClick={() => approveMutation.mutate(t.id)} data-testid={`button-approve-${t.id}`}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200" onClick={() => rejectMutation.mutate(t.id)} data-testid={`button-reject-${t.id}`}>
                              <X className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
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
