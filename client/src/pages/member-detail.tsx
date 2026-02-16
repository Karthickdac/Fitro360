import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, Ruler, Weight, Activity, Plus, Calendar, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Member, MemberMetric, Attendance } from "@shared/schema";

const addMetricSchema = z.object({
  heightCm: z.string().min(1, "Height is required"),
  weightKg: z.string().min(1, "Weight is required"),
  bodyFatPct: z.string().optional(),
  notes: z.string().optional(),
});

function getBmiColor(bmi: number): string {
  if (bmi < 18.5) return "text-blue-500";
  if (bmi < 25) return "text-green-500";
  if (bmi < 30) return "text-yellow-500";
  return "text-red-500";
}

function getBmiLabel(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function formatDuration(checkIn: string | Date | null, checkOut: string | Date | null): string {
  if (!checkIn || !checkOut) return "—";
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const diffMs = end - start;
  if (diffMs < 0) return "—";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: member, isLoading: memberLoading } = useQuery<Member>({
    queryKey: ["/api/members", id],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<MemberMetric[]>({
    queryKey: ["/api/members", id, "metrics"],
  });

  const { data: allAttendance } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance"],
  });

  const memberAttendance = (allAttendance || [])
    .filter((a) => a.memberId === id)
    .sort((a, b) => new Date(b.checkInTime!).getTime() - new Date(a.checkInTime!).getTime())
    .slice(0, 20);

  const form = useForm({
    resolver: zodResolver(addMetricSchema),
    defaultValues: {
      heightCm: member?.heightCm || "",
      weightKg: member?.weightKg || "",
      bodyFatPct: "",
      notes: "",
    },
  });

  const watchHeight = form.watch("heightCm");
  const watchWeight = form.watch("weightKg");
  const previewBmi =
    watchHeight && watchWeight
      ? (parseFloat(watchWeight) / Math.pow(parseFloat(watchHeight) / 100, 2)).toFixed(1)
      : null;

  const addMetricMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addMetricSchema>) => {
      const res = await apiRequest("POST", `/api/members/${id}/metrics`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", id, "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Metrics recorded successfully" });
      form.reset({ heightCm: "", weightKg: "", bodyFatPct: "", notes: "" });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add metrics", description: error.message, variant: "destructive" });
    },
  });

  const chartData = [...(metrics || [])]
    .sort((a, b) => new Date(a.recordedAt!).getTime() - new Date(b.recordedAt!).getTime())
    .map((m) => ({
      date: format(new Date(m.recordedAt!), "MMM d"),
      weight: m.weightKg ? parseFloat(m.weightKg) : null,
      bmi: m.bmi ? parseFloat(m.bmi) : null,
    }));

  const latestMetric = metrics && metrics.length > 0 ? metrics[0] : null;
  const currentBmi = latestMetric?.bmi ? parseFloat(latestMetric.bmi) : member?.bmi ? parseFloat(member.bmi) : null;
  const currentHeight = latestMetric?.heightCm || member?.heightCm;
  const currentWeight = latestMetric?.weightKg || member?.weightKg;
  const currentBodyFat = latestMetric?.bodyFatPct;

  const daysRemaining = member?.membershipEnd
    ? Math.max(0, Math.ceil((new Date(member.membershipEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (memberLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-member-detail-loading">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6" data-testid="page-member-not-found">
        <Button variant="ghost" onClick={() => setLocation("/members")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-xl font-semibold">Member not found</h2>
          <p className="text-muted-foreground mt-1">The member you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-member-detail">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/members")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-member-name">
                {member.firstName} {member.lastName}
              </h1>
              <Badge
                variant="outline"
                className={member.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : member.status === "frozen" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200"}
                data-testid="badge-status"
              >
                {member.status}
              </Badge>
              <Badge variant="outline" className="capitalize bg-violet-100 text-violet-700 border-violet-200" data-testid="badge-membership">
                {member.membershipType.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1" data-testid="text-member-email">{member.email}</p>
            {member.membershipStart && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-join-date">
                Joined {format(new Date(member.membershipStart), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-metrics">
              <Plus className="h-4 w-4 mr-2" />
              Add Metrics
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Metrics</DialogTitle>
              <DialogDescription>Add new body measurements for {member.firstName}.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => addMetricMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="heightCm" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="175" {...field} data-testid="input-metric-height" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="weightKg" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="70" {...field} data-testid="input-metric-weight" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="bodyFatPct" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Fat %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="15" {...field} data-testid="input-metric-bodyfat" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional notes..." {...field} data-testid="input-metric-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {previewBmi && !isNaN(parseFloat(previewBmi)) && (
                  <div className="p-3 rounded-md bg-muted text-center" data-testid="text-bmi-preview">
                    <p className="text-sm text-muted-foreground">Calculated BMI</p>
                    <p className={`text-2xl font-bold ${getBmiColor(parseFloat(previewBmi))}`}>
                      {previewBmi}
                    </p>
                    <p className="text-xs text-muted-foreground">{getBmiLabel(parseFloat(previewBmi))}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={addMetricMutation.isPending} data-testid="button-submit-metrics">
                  {addMetricMutation.isPending ? "Saving..." : "Save Metrics"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/40 dark:to-violet-900/30" data-testid="card-bmi">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-violet-600" />
              <p className="text-sm text-violet-600 dark:text-violet-400">BMI</p>
            </div>
            {currentBmi !== null ? (
              <>
                <p className={`text-2xl font-bold ${getBmiColor(currentBmi)}`} data-testid="text-bmi-value">
                  {currentBmi.toFixed(1)}
                </p>
                <p className={`text-xs ${getBmiColor(currentBmi)}`}>{getBmiLabel(currentBmi)}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30" data-testid="card-height">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ruler className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-600 dark:text-blue-400">Height</p>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-height-value">
              {currentHeight ? `${currentHeight} cm` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30" data-testid="card-weight">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Weight className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Weight</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-weight-value">
              {currentWeight ? `${currentWeight} kg` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/30" data-testid="card-bodyfat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-rose-600" />
              <p className="text-sm text-rose-600 dark:text-rose-400">Body Fat</p>
            </div>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300" data-testid="text-bodyfat-value">
              {currentBodyFat ? `${currentBodyFat}%` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30" data-testid="card-days-remaining">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-600 dark:text-amber-400">Days Left</p>
            </div>
            <p className={`text-2xl font-bold ${daysRemaining !== null && daysRemaining <= 7 ? "text-red-500" : "text-amber-700 dark:text-amber-300"}`} data-testid="text-days-remaining">
              {daysRemaining !== null ? daysRemaining : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card data-testid="card-progress-chart">
          <CardHeader>
            <CardTitle className="text-lg">BMI / Weight Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "Weight (kg)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "BMI", angle: 90, position: "insideRight", style: { fontSize: 12 } }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="weight" stroke="hsl(217, 91%, 35%)" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="bmi" stroke="hsl(173, 58%, 39%)" strokeWidth={2} dot={{ r: 3 }} name="BMI" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-metrics-history">
        <CardHeader>
          <CardTitle className="text-lg">Metrics History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metricsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !metrics || metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No metrics recorded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Metrics" to start tracking progress.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Height (cm)</TableHead>
                  <TableHead>Weight (kg)</TableHead>
                  <TableHead>BMI</TableHead>
                  <TableHead>Body Fat %</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.id} data-testid={`row-metric-${metric.id}`}>
                    <TableCell className="text-sm">
                      {metric.recordedAt ? format(new Date(metric.recordedAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{metric.heightCm || "—"}</TableCell>
                    <TableCell className="text-sm">{metric.weightKg || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {metric.bmi ? (
                        <span className={`font-medium ${getBmiColor(parseFloat(metric.bmi))}`}>
                          {metric.bmi}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{metric.bodyFatPct ? `${metric.bodyFatPct}%` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{metric.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-attendance-history">
        <CardHeader>
          <CardTitle className="text-lg">Attendance History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {memberAttendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No attendance records found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberAttendance.map((record) => (
                  <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                    <TableCell className="text-sm">
                      {record.checkInTime ? format(new Date(record.checkInTime), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.checkInTime ? format(new Date(record.checkInTime), "h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.checkOutTime ? format(new Date(record.checkOutTime), "h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(record.checkInTime, record.checkOutTime)}
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
