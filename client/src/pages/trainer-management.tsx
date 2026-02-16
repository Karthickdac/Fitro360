import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DollarSign, Calendar, Users, BarChart3, Award, Check, X, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { User, TrainerSession, TrainerCommission, TrainerLeave } from "@shared/schema";

const commissionSchema = z.object({
  trainerId: z.string().min(1, "Trainer is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.string().min(1, "Type is required"),
  sessionId: z.string().optional(),
  notes: z.string().optional(),
});

const leaveSchema = z.object({
  trainerId: z.string().min(1, "Trainer is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

function CommissionsTab() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: commissions, isLoading: loadingComm } = useQuery<TrainerCommission[]>({
    queryKey: ["/api/commissions"],
  });
  const { data: trainers } = useQuery<User[]>({ queryKey: ["/api/trainers"] });
  const { data: sessions } = useQuery<TrainerSession[]>({ queryKey: ["/api/sessions"] });

  const form = useForm<z.infer<typeof commissionSchema>>({
    resolver: zodResolver(commissionSchema),
    defaultValues: { trainerId: "", amount: "", type: "session", sessionId: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof commissionSchema>) => {
      const body: any = { trainerId: data.trainerId, amount: data.amount, type: data.type, notes: data.notes };
      if (data.sessionId) body.sessionId = data.sessionId;
      const res = await apiRequest("POST", "/api/commissions", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      toast({ title: "Commission added" });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/commissions/${id}`, { status: "paid", paidAt: new Date().toISOString() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      toast({ title: "Commission marked as paid" });
    },
  });

  const trainerName = (id: string) => {
    const t = trainers?.find((tr) => tr.id === id);
    return t ? `${t.firstName} ${t.lastName}` : "Unknown";
  };

  const sessionTitle = (id: string | null) => {
    if (!id) return "-";
    const s = sessions?.find((sess) => sess.id === id);
    return s ? s.title : "-";
  };

  const totalAmount = commissions?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
  const pendingAmount = commissions?.filter((c) => c.status === "pending").reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
  const paidAmount = commissions?.filter((c) => c.status === "paid").reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
  const now = new Date();
  const thisMonthAmount = commissions?.filter((c) => {
    const d = new Date(c.createdAt!);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;

  if (loadingComm) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Commissions" value={`AED ${totalAmount.toFixed(2)}`} icon={DollarSign} data-testid="stat-total-commissions" />
        <StatCard title="Pending Amount" value={`AED ${pendingAmount.toFixed(2)}`} icon={DollarSign} data-testid="stat-pending-amount" />
        <StatCard title="Paid Amount" value={`AED ${paidAmount.toFixed(2)}`} icon={Check} data-testid="stat-paid-amount" />
        <StatCard title="This Month" value={`AED ${thisMonthAmount.toFixed(2)}`} icon={Calendar} data-testid="stat-this-month" />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Commission Records</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-commission"><Plus className="h-4 w-4 mr-2" />Add Commission</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Commission</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="trainerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trainer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-commission-trainer"><SelectValue placeholder="Select trainer" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-commission-amount" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-commission-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="session">Session</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sessionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-commission-session"><SelectValue placeholder="Select session" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {sessions?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Optional notes" data-testid="input-commission-notes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-commission">
                  {createMutation.isPending ? "Adding..." : "Add Commission"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!commissions || commissions.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No commissions recorded yet</TableCell>
                </TableRow>
              ) : commissions.map((c) => (
                <TableRow key={c.id} data-testid={`row-commission-${c.id}`}>
                  <TableCell className="font-medium">{trainerName(c.trainerId)}</TableCell>
                  <TableCell>{sessionTitle(c.sessionId)}</TableCell>
                  <TableCell>AED {parseFloat(c.amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="secondary">{c.type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={c.status === "paid" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.createdAt ? format(new Date(c.createdAt), "MMM dd, yyyy") : "-"}</TableCell>
                  <TableCell>
                    {c.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(c.id)} disabled={markPaidMutation.isPending} data-testid={`button-mark-paid-${c.id}`}>
                        <Check className="h-3.5 w-3.5 mr-1" />Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LeavesTab() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: leaves, isLoading: loadingLeaves } = useQuery<TrainerLeave[]>({
    queryKey: ["/api/leaves"],
  });
  const { data: trainers } = useQuery<User[]>({ queryKey: ["/api/trainers"] });

  const form = useForm<z.infer<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { trainerId: "", startDate: "", endDate: "", reason: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof leaveSchema>) => {
      const res = await apiRequest("POST", "/api/leaves", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "Leave request submitted" });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/leaves/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "Leave status updated" });
    },
  });

  const trainerName = (id: string) => {
    const t = trainers?.find((tr) => tr.id === id);
    return t ? `${t.firstName} ${t.lastName}` : "Unknown";
  };

  const getDuration = (start: string | Date, end: string | Date) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalLeaves = leaves?.length || 0;
  const pendingLeaves = leaves?.filter((l) => l.status === "pending").length || 0;
  const approvedLeaves = leaves?.filter((l) => l.status === "approved").length || 0;
  const rejectedLeaves = leaves?.filter((l) => l.status === "rejected").length || 0;

  if (loadingLeaves) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leave Requests" value={totalLeaves} icon={Calendar} data-testid="stat-total-leaves" />
        <StatCard title="Pending" value={pendingLeaves} icon={Calendar} data-testid="stat-pending-leaves" />
        <StatCard title="Approved" value={approvedLeaves} icon={Check} data-testid="stat-approved-leaves" />
        <StatCard title="Rejected" value={rejectedLeaves} icon={X} data-testid="stat-rejected-leaves" />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Leave Records</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-request-leave"><Plus className="h-4 w-4 mr-2" />Request Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="trainerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trainer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-leave-trainer"><SelectValue placeholder="Select trainer" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input {...field} type="date" data-testid="input-leave-start" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input {...field} type="date" data-testid="input-leave-end" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Reason for leave" data-testid="input-leave-reason" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-leave">
                  {createMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!leaves || leaves.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leave requests yet</TableCell>
                </TableRow>
              ) : leaves.map((l) => (
                <TableRow key={l.id} data-testid={`row-leave-${l.id}`}>
                  <TableCell className="font-medium">{trainerName(l.trainerId)}</TableCell>
                  <TableCell>{format(new Date(l.startDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{format(new Date(l.endDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{getDuration(l.startDate, l.endDate)} days</TableCell>
                  <TableCell className="max-w-[200px] truncate">{l.reason || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: l.id, status: "approved" })} data-testid={`button-approve-leave-${l.id}`}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: l.id, status: "rejected" })} data-testid={`button-reject-leave-${l.id}`}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceTab() {
  const { data: trainers, isLoading: loadingTrainers } = useQuery<User[]>({ queryKey: ["/api/trainers"] });
  const { data: sessions } = useQuery<TrainerSession[]>({ queryKey: ["/api/sessions"] });
  const { data: commissions } = useQuery<TrainerCommission[]>({ queryKey: ["/api/commissions"] });

  if (loadingTrainers) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalSessions = sessions?.length || 0;
  const totalCommission = commissions?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;

  const trainerStats = trainers?.map((t) => {
    const trainerSess = sessions?.filter((s) => s.trainerId === t.id) || [];
    const trainerComm = commissions?.filter((c) => c.trainerId === t.id) || [];
    const groupSessions = trainerSess.filter((s) => s.type === "group").length;
    const personalSessions = trainerSess.filter((s) => s.type === "personal").length;
    const commTotal = trainerComm.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    return {
      name: `${t.firstName} ${t.lastName}`,
      id: t.id,
      totalSessions: trainerSess.length,
      groupSessions,
      personalSessions,
      totalCommission: commTotal,
    };
  }) || [];

  const chartData = trainerStats.map((t) => ({
    name: t.name,
    sessions: t.totalSessions,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Sessions" value={totalSessions} icon={Users} data-testid="stat-total-sessions" />
        <StatCard title="Total Commission" value={`AED ${totalCommission.toFixed(2)}`} icon={DollarSign} data-testid="stat-total-commission" />
        <StatCard title="Avg Rating" value="4.5" icon={Award} data-testid="stat-avg-rating" />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Sessions per Trainer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-sessions-per-trainer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
                  <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead>Total Sessions</TableHead>
                <TableHead>Group Sessions</TableHead>
                <TableHead>Personal Sessions</TableHead>
                <TableHead>Total Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainerStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No trainer data available</TableCell>
                </TableRow>
              ) : trainerStats.map((t) => (
                <TableRow key={t.id} data-testid={`row-performance-${t.id}`}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.totalSessions}</TableCell>
                  <TableCell>{t.groupSessions}</TableCell>
                  <TableCell>{t.personalSessions}</TableCell>
                  <TableCell>${t.totalCommission.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrainerManagementPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-trainer-management">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trainer Management</h1>
        <p className="text-muted-foreground mt-1">Commissions, leave management, and performance analytics</p>
      </div>

      <Tabs defaultValue="commissions" className="space-y-6">
        <TabsList data-testid="tabs-trainer-management">
          <TabsTrigger value="commissions" data-testid="tab-commissions">
            <DollarSign className="h-4 w-4 mr-2" />Commissions
          </TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-leaves">
            <Calendar className="h-4 w-4 mr-2" />Leave Management
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <BarChart3 className="h-4 w-4 mr-2" />Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commissions">
          <CommissionsTab />
        </TabsContent>

        <TabsContent value="leaves">
          <LeavesTab />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
