import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  CalendarCheck, Shield, Clock, Activity, User, Calendar,
  TrendingDown, Weight, Ruler, Percent, Dumbbell, BookOpen,
  Check, X, Loader2, Phone, AlertCircle,
} from "lucide-react";
import { format, differenceInDays, differenceInMinutes } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Member, MemberMetric, Attendance, TrainerSession, SessionBooking } from "@shared/schema";

const profileSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
});

const metricSchema = z.object({
  heightCm: z.string().min(1, "Height is required"),
  weightKg: z.string().min(1, "Weight is required"),
  bodyFatPct: z.string().optional(),
  notes: z.string().optional(),
});

export default function MemberPortalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showMetricDialog, setShowMetricDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const { data: member, isLoading: memberLoading } = useQuery<Member>({
    queryKey: ["/api/member/me"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<MemberMetric[]>({
    queryKey: ["/api/member/me/metrics"],
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/member/me/attendance"],
  });

  const { data: sessions } = useQuery<TrainerSession[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: trainers } = useQuery<any[]>({
    queryKey: ["/api/trainers"],
  });

  const { data: myBookings } = useQuery<SessionBooking[]>({
    queryKey: ["/api/member/me/bookings"],
  });

  const daysRemaining = member?.membershipEnd
    ? Math.max(0, differenceInDays(new Date(member.membershipEnd), new Date()))
    : 0;

  const upcomingSessions = sessions?.filter(
    (s) => s.status === "scheduled" && new Date(s.startTime) >= new Date()
  ) || [];

  const bookedSessionIds = new Set(myBookings?.filter(b => b.status === "confirmed").map(b => b.sessionId) || []);

  const trainerMap = new Map(trainers?.map(t => [t.id, `${t.firstName} ${t.lastName}`]) || []);

  const bookMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("POST", `/api/member/me/book/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/me/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session booked successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await apiRequest("DELETE", `/api/member/me/book/${bookingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/me/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Booking cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Cancellation failed", description: error.message, variant: "destructive" });
    },
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: member?.phone || "",
      emergencyContact: member?.emergencyContact || "",
      heightCm: member?.heightCm || "",
      weightKg: member?.weightKg || "",
    },
  });

  const metricForm = useForm<z.infer<typeof metricSchema>>({
    resolver: zodResolver(metricSchema),
    defaultValues: {
      heightCm: member?.heightCm || "",
      weightKg: member?.weightKg || "",
      bodyFatPct: "",
      notes: "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      await apiRequest("PATCH", "/api/member/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/me"] });
      setShowProfileDialog(false);
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const metricMutation = useMutation({
    mutationFn: async (data: z.infer<typeof metricSchema>) => {
      await apiRequest("POST", "/api/member/me/metrics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/me/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/me"] });
      setShowMetricDialog(false);
      metricForm.reset();
      toast({ title: "Progress entry recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = memberLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="member-portal-loading">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
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

  const chartData = metrics?.map(m => ({
    date: format(new Date(m.recordedAt!), "MMM d"),
    weight: m.weightKg ? Number(m.weightKg) : null,
    bmi: m.bmi ? Number(m.bmi) : null,
    bodyFat: m.bodyFatPct ? Number(m.bodyFatPct) : null,
  })).reverse() || [];

  const myAttendance = attendance || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-member-portal">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-member-welcome">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-member-subtitle">
          Here's your fitness overview
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-member-portal">
        <TabsList className="grid w-full grid-cols-4" data-testid="tablist-member-portal">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">My Progress</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">Book Sessions</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">My Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6" data-testid="panel-dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="My Attendance"
              value={myAttendance.length}
              icon={CalendarCheck}
            />
            <StatCard
              title="Membership Status"
              value={member?.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : "N/A"}
              icon={Shield}
            />
            <StatCard
              title="Days Remaining"
              value={daysRemaining}
              icon={Clock}
              subtitle={member?.membershipEnd ? `Expires ${format(new Date(member.membershipEnd), "MMM d, yyyy")}` : "No end date"}
            />
            <StatCard
              title="BMI"
              value={member?.bmi ? Number(member.bmi).toFixed(1) : "N/A"}
              icon={Activity}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold" data-testid="text-attendance-title">
                  Recent Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myAttendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-attendance">
                    No attendance records found
                  </p>
                ) : (
                  <Table data-testid="table-attendance">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAttendance.slice(0, 5).map((record) => {
                        const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
                        const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
                        const duration = checkIn && checkOut ? differenceInMinutes(checkOut, checkIn) : null;
                        return (
                          <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                            <TableCell>{checkIn ? format(checkIn, "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell>{checkIn ? format(checkIn, "h:mm a") : "—"}</TableCell>
                            <TableCell>{checkOut ? format(checkOut, "h:mm a") : "—"}</TableCell>
                            <TableCell>
                              {duration !== null ? `${Math.floor(duration / 60)}h ${duration % 60}m` : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold" data-testid="text-upcoming-title">
                  My Booked Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookedSessionIds.size === 0 ? (
                  <div className="text-center py-6">
                    <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-bookings">
                      No sessions booked yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setActiveTab("sessions")}
                      data-testid="button-browse-sessions"
                    >
                      Browse Sessions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingSessions
                      .filter(s => bookedSessionIds.has(s.id))
                      .slice(0, 4)
                      .map((session) => {
                        const booking = myBookings?.find(b => b.sessionId === session.id && b.status === "confirmed");
                        return (
                          <div key={session.id} className="flex items-start justify-between p-3 rounded-lg border" data-testid={`card-booked-session-${session.id}`}>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{session.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {trainerMap.get(session.trainerId) || "Trainer"} • {format(new Date(session.startTime), "MMM d, h:mm a")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive shrink-0"
                              onClick={() => booking && cancelBookingMutation.mutate(booking.id)}
                              disabled={cancelBookingMutation.isPending}
                              data-testid={`button-cancel-booking-${session.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {chartData.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Weight Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]" data-testid="chart-weight-mini">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Area type="monotone" dataKey="weight" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Weight (kg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-6 mt-6" data-testid="panel-progress">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">My Progress</h2>
              <p className="text-sm text-muted-foreground">Track your fitness journey over time</p>
            </div>
            <Button onClick={() => {
              metricForm.reset({
                heightCm: member?.heightCm || "",
                weightKg: member?.weightKg || "",
                bodyFatPct: "",
                notes: "",
              });
              setShowMetricDialog(true);
            }} data-testid="button-log-progress">
              <TrendingDown className="h-4 w-4 mr-2" />
              Log Progress
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Height</span>
                </div>
                <p className="text-xl font-bold" data-testid="text-current-height">
                  {member?.heightCm ? `${member.heightCm} cm` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Weight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Weight</span>
                </div>
                <p className="text-xl font-bold" data-testid="text-current-weight">
                  {member?.weightKg ? `${member.weightKg} kg` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">BMI</span>
                </div>
                <p className="text-xl font-bold" data-testid="text-current-bmi">
                  {member?.bmi ? Number(member.bmi).toFixed(1) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Body Fat</span>
                </div>
                <p className="text-xl font-bold" data-testid="text-current-bodyfat">
                  {metrics && metrics.length > 0 && metrics[0].bodyFatPct ? `${metrics[0].bodyFatPct}%` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 1 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Weight & BMI Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]" data-testid="chart-weight-bmi">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Weight (kg)" />
                        <Line yAxisId="right" type="monotone" dataKey="bmi" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="BMI" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Body Fat %</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]" data-testid="chart-body-fat">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Area type="monotone" dataKey="bodyFat" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} name="Body Fat %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingDown className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Not enough data to display charts. Log at least 2 progress entries to see your trends.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Progress History</CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : !metrics || metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-metrics">
                  No progress records yet
                </p>
              ) : (
                <Table data-testid="table-metrics">
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
                    {metrics.map((m) => (
                      <TableRow key={m.id} data-testid={`row-metric-${m.id}`}>
                        <TableCell>{m.recordedAt ? format(new Date(m.recordedAt), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>{m.heightCm || "—"}</TableCell>
                        <TableCell>{m.weightKg || "—"}</TableCell>
                        <TableCell>{m.bmi || "—"}</TableCell>
                        <TableCell>{m.bodyFatPct ? `${m.bodyFatPct}%` : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6 mt-6" data-testid="panel-sessions">
          <div>
            <h2 className="text-lg font-semibold">Available Sessions</h2>
            <p className="text-sm text-muted-foreground">Browse and book upcoming training sessions</p>
          </div>

          {upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-available-sessions">
                  No upcoming sessions available
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingSessions.map((session) => {
                const isBooked = bookedSessionIds.has(session.id);
                const isFull = (session.enrolled || 0) >= (session.capacity || 1);
                const booking = myBookings?.find(b => b.sessionId === session.id && b.status === "confirmed");
                return (
                  <Card key={session.id} className={isBooked ? "border-primary/50 bg-primary/5" : ""} data-testid={`card-session-${session.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm" data-testid={`text-session-title-${session.id}`}>
                            {session.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {trainerMap.get(session.trainerId) || "Trainer"}
                          </p>
                        </div>
                        <Badge variant={session.type === "personal" ? "default" : "secondary"} className="shrink-0">
                          {session.type}
                        </Badge>
                      </div>

                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(session.startTime), "EEEE, MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(session.startTime), "h:mm a")} – {format(new Date(session.endTime), "h:mm a")}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {session.enrolled}/{session.capacity} spots filled
                        </div>
                      </div>

                      {isBooked ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <Check className="h-3 w-3 mr-1" /> Booked
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive ml-auto"
                            onClick={() => booking && cancelBookingMutation.mutate(booking.id)}
                            disabled={cancelBookingMutation.isPending}
                            data-testid={`button-cancel-session-${session.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={isFull || bookMutation.isPending}
                          onClick={() => bookMutation.mutate(session.id)}
                          data-testid={`button-book-session-${session.id}`}
                        >
                          {bookMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : isFull ? (
                            "Session Full"
                          ) : (
                            "Book Session"
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile" className="space-y-6 mt-6" data-testid="panel-profile">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">My Profile</h2>
              <p className="text-sm text-muted-foreground">View and manage your personal information</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                profileForm.reset({
                  phone: member?.phone || "",
                  emergencyContact: member?.emergencyContact || "",
                  heightCm: member?.heightCm || "",
                  weightKg: member?.weightKg || "",
                });
                setShowProfileDialog(true);
              }}
              data-testid="button-edit-profile"
            >
              Edit Profile
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                    <p className="text-sm font-medium" data-testid="text-profile-name">
                      {member?.firstName} {member?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="text-sm font-medium" data-testid="text-profile-email">
                      {member?.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm font-medium" data-testid="text-profile-phone">
                      {member?.phone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Emergency Contact</p>
                    <p className="text-sm font-medium" data-testid="text-profile-emergency">
                      {member?.emergencyContact || "Not provided"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Membership Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Membership Type</p>
                    <p className="text-sm font-medium capitalize" data-testid="text-profile-membership-type">
                      {member?.membershipType || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge
                      variant={member?.status === "active" ? "default" : "secondary"}
                      data-testid="badge-profile-status"
                    >
                      {member?.status || "—"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                    <p className="text-sm font-medium" data-testid="text-profile-start">
                      {member?.membershipStart ? format(new Date(member.membershipStart), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">End Date</p>
                    <p className="text-sm font-medium" data-testid="text-profile-end">
                      {member?.membershipEnd ? format(new Date(member.membershipEnd), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
                {daysRemaining <= 14 && daysRemaining > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="text-membership-warning">
                      Your membership expires in {daysRemaining} days
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Body Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Height</p>
                    <p className="text-sm font-medium" data-testid="text-profile-height">
                      {member?.heightCm ? `${member.heightCm} cm` : "Not recorded"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Weight</p>
                    <p className="text-sm font-medium" data-testid="text-profile-weight">
                      {member?.weightKg ? `${member.weightKg} kg` : "Not recorded"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">BMI</p>
                    <p className="text-sm font-medium" data-testid="text-profile-bmi">
                      {member?.bmi ? Number(member.bmi).toFixed(1) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Latest Body Fat</p>
                    <p className="text-sm font-medium" data-testid="text-profile-bodyfat">
                      {metrics && metrics.length > 0 && metrics[0].bodyFatPct ? `${metrics[0].bodyFatPct}%` : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Visits</p>
                    <p className="text-sm font-medium" data-testid="text-profile-visits">
                      {myAttendance.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">This Month</p>
                    <p className="text-sm font-medium" data-testid="text-profile-this-month">
                      {myAttendance.filter(a => {
                        const d = a.checkInTime ? new Date(a.checkInTime) : null;
                        const now = new Date();
                        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                      }).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Booked Sessions</p>
                    <p className="text-sm font-medium" data-testid="text-profile-bookings">
                      {myBookings?.filter(b => b.status === "confirmed").length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showMetricDialog} onOpenChange={setShowMetricDialog}>
        <DialogContent data-testid="dialog-log-progress">
          <DialogHeader>
            <DialogTitle>Log Progress</DialogTitle>
            <DialogDescription>Record your latest body measurements</DialogDescription>
          </DialogHeader>
          <Form {...metricForm}>
            <form onSubmit={metricForm.handleSubmit((data) => metricMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={metricForm.control} name="heightCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl><Input {...field} placeholder="178" data-testid="input-metric-height" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={metricForm.control} name="weightKg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl><Input {...field} placeholder="80.5" data-testid="input-metric-weight" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={metricForm.control} name="bodyFatPct" render={({ field }) => (
                <FormItem>
                  <FormLabel>Body Fat % (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="18.5" data-testid="input-metric-bodyfat" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={metricForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Feeling good this week" data-testid="input-metric-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={metricMutation.isPending} data-testid="button-submit-metric">
                {metricMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Progress
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent data-testid="dialog-edit-profile">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your contact and body information</DialogDescription>
          </DialogHeader>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))} className="space-y-4">
              <FormField control={profileForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} placeholder="+1 555-1001" data-testid="input-profile-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input {...field} placeholder="Name - Phone" data-testid="input-profile-emergency" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={profileForm.control} name="heightCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl><Input {...field} placeholder="178" data-testid="input-profile-height" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="weightKg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl><Input {...field} placeholder="80.5" data-testid="input-profile-weight" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={profileMutation.isPending} data-testid="button-submit-profile">
                {profileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
