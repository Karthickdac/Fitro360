import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trash2,
  Clock,
  Users,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import type { TrainerSession, User } from "@shared/schema";

const addSessionSchema = z.object({
  trainerId: z.string().min(1, "Trainer is required"),
  title: z.string().min(1, "Title is required"),
  type: z.string().min(1, "Type is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  notes: z.string().optional(),
});

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function SchedulePage() {
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trainerFilter, setTrainerFilter] = useState("all");
  const [selectedSession, setSelectedSession] = useState<TrainerSession | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: sessions, isLoading: sessionsLoading } = useQuery<TrainerSession[]>({
    queryKey: ["/api/sessions", `?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`],
  });

  const { data: trainers, isLoading: trainersLoading } = useQuery<User[]>({
    queryKey: ["/api/trainers"],
  });

  const form = useForm({
    resolver: zodResolver(addSessionSchema),
    defaultValues: {
      trainerId: "",
      title: "",
      type: "personal",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      capacity: 1,
      notes: "",
    },
  });

  const sessionType = form.watch("type");

  const addSessionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addSessionSchema>) => {
      const startTime = new Date(`${data.date}T${data.startTime}:00`);
      const endTime = new Date(`${data.date}T${data.endTime}:00`);
      const res = await apiRequest("POST", "/api/sessions", {
        trainerId: data.trainerId,
        title: data.title,
        type: data.type,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        capacity: data.capacity,
        notes: data.notes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session created successfully" });
      form.reset({
        trainerId: "",
        title: "",
        type: "personal",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        capacity: 1,
        notes: "",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      const message = error.message.includes("conflicting")
        ? "This trainer already has a session at the selected time. Please choose a different time."
        : error.message;
      toast({ title: "Failed to create session", description: message, variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session deleted" });
      setSelectedSession(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete session", description: error.message, variant: "destructive" });
    },
  });

  const trainerMap = useMemo(() => {
    const map: Record<string, User> = {};
    (trainers || []).forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [trainers]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (trainerFilter === "all") return sessions;
    return sessions.filter((s) => s.trainerId === trainerFilter);
  }, [sessions, trainerFilter]);

  const getSessionsForSlot = (day: Date, hour: number) => {
    return filteredSessions.filter((session) => {
      const start = new Date(session.startTime);
      const startHour = start.getHours();
      return isSameDay(start, day) && startHour === hour;
    });
  };

  const getSessionSpan = (session: TrainerSession) => {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(1, Math.round(durationHours));
  };

  const isLoading = sessionsLoading || trainersLoading;

  return (
    <div className="p-6 space-y-6" data-testid="page-schedule">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage trainer sessions and bookings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-session">
              <Plus className="h-4 w-4 mr-2" />
              Add Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Session</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => addSessionMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="trainerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trainer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-trainer">
                            <SelectValue placeholder="Select trainer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(trainers || []).map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id}>
                              {trainer.firstName} {trainer.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Session title" {...field} data-testid="input-session-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          if (val === "personal") form.setValue("capacity", 1);
                          if (val === "group") form.setValue("capacity", 20);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-session-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-session-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-start-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-end-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} data-testid="input-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional notes..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addSessionMutation.isPending}
                  data-testid="button-submit-session"
                >
                  {addSessionMutation.isPending ? "Creating..." : "Create Session"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentWeek(new Date())}
            data-testid="button-today"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-medium" data-testid="text-week-range">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </span>
        <div className="ml-auto">
          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger className="w-48" data-testid="select-trainer-filter">
              <SelectValue placeholder="Filter by trainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {(trainers || []).map((trainer) => (
                <SelectItem key={trainer.id} value={trainer.id}>
                  {trainer.firstName} {trainer.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-blue-500" />
          <span className="text-xs text-muted-foreground">Personal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-green-500" />
          <span className="text-xs text-muted-foreground">Group</span>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16 shrink-0" />
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <Skeleton key={j} className="h-12 flex-1" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full border-collapse min-w-[800px]" data-testid="table-calendar">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border-b border-r p-2 text-xs font-medium text-muted-foreground w-20">
                      <Clock className="h-3.5 w-3.5 mx-auto" />
                    </th>
                    {weekDays.map((day, idx) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <th
                          key={idx}
                          className={`border-b border-r p-2 text-center min-w-[120px] ${isToday ? "bg-primary/5" : ""}`}
                          data-testid={`header-day-${format(day, "EEE").toLowerCase()}`}
                        >
                          <div className="text-xs font-medium text-muted-foreground">
                            {format(day, "EEE")}
                          </div>
                          <div className={`text-sm font-semibold mt-0.5 ${isToday ? "text-primary" : ""}`}>
                            {format(day, "d")}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="sticky left-0 z-10 bg-background border-b border-r p-2 text-xs text-muted-foreground text-right align-top w-20">
                        {formatHour(hour)}
                      </td>
                      {weekDays.map((day, dayIdx) => {
                        const slotSessions = getSessionsForSlot(day, hour);
                        const isToday = isSameDay(day, new Date());
                        return (
                          <td
                            key={dayIdx}
                            className={`border-b border-r p-1 align-top h-14 ${isToday ? "bg-primary/5" : ""}`}
                            data-testid={`cell-${format(day, "yyyy-MM-dd")}-${hour}`}
                          >
                            {slotSessions.map((session) => {
                              const trainer = trainerMap[session.trainerId];
                              const isPersonal = session.type === "personal";
                              return (
                                <button
                                  key={session.id}
                                  className={`w-full text-left rounded-md p-1.5 mb-1 text-xs cursor-pointer border-0 ${
                                    isPersonal
                                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                      : "bg-green-500/15 text-green-700 dark:text-green-300"
                                  }`}
                                  onClick={() => setSelectedSession(session)}
                                  data-testid={`session-block-${session.id}`}
                                >
                                  <div className="font-medium truncate">{session.title}</div>
                                  {trainer && (
                                    <div className="truncate opacity-80">
                                      {trainer.firstName} {trainer.lastName}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between gap-1 mt-0.5 opacity-70">
                                    <span>
                                      {format(new Date(session.startTime), "h:mm a")}
                                    </span>
                                    <span>
                                      {session.enrolled || 0}/{session.capacity || 1}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      selectedSession.type === "personal"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                        : "bg-green-500/15 text-green-700 dark:text-green-300"
                    }
                  >
                    {selectedSession.type === "personal" ? "Personal" : "Group"}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold" data-testid="text-session-title">
                  {selectedSession.title}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span data-testid="text-session-date">
                      {format(new Date(selectedSession.startTime), "EEEE, MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span data-testid="text-session-time">
                      {format(new Date(selectedSession.startTime), "h:mm a")} -{" "}
                      {format(new Date(selectedSession.endTime), "h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span data-testid="text-session-capacity">
                      {selectedSession.enrolled || 0} / {selectedSession.capacity || 1} enrolled
                    </span>
                  </div>
                  {trainerMap[selectedSession.trainerId] && (
                    <div className="text-muted-foreground" data-testid="text-session-trainer">
                      Trainer: {trainerMap[selectedSession.trainerId].firstName}{" "}
                      {trainerMap[selectedSession.trainerId].lastName}
                    </div>
                  )}
                  {selectedSession.notes && (
                    <div className="text-muted-foreground pt-1" data-testid="text-session-notes">
                      {selectedSession.notes}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteSessionMutation.mutate(selectedSession.id)}
                disabled={deleteSessionMutation.isPending}
                data-testid="button-delete-session"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteSessionMutation.isPending ? "Deleting..." : "Delete Session"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!isLoading && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No sessions this week</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            {trainerFilter !== "all"
              ? "No sessions found for the selected trainer this week"
              : "Get started by adding your first training session"}
          </p>
        </div>
      )}
    </div>
  );
}
