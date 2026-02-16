import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Users, Clock, ArrowRight, Sparkles, Dumbbell } from "lucide-react";
import { format, isToday, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Link } from "wouter";
import type { Member, TrainerSession } from "@shared/schema";

const avatarColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
];

export default function TrainerPortalPage() {
  const { user } = useAuth();

  const { data: sessions, isLoading: sessionsLoading } = useQuery<TrainerSession[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const mySessions = sessions?.filter((s) => s.trainerId === user?.id) || [];

  const todaysSessions = mySessions.filter((s) => isToday(new Date(s.startTime)));

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeekSessions = mySessions.filter((s) =>
    isWithinInterval(new Date(s.startTime), { start: weekStart, end: weekEnd })
  );

  const isLoading = sessionsLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="trainer-portal-loading">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-trainer-portal">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-trainer-welcome">
              Welcome back, {user?.firstName}
            </h1>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-muted-foreground mt-1" data-testid="text-trainer-subtitle">
            Here's your training overview for today
          </p>
        </div>
        <Link href="/schedule">
          <Button data-testid="button-view-schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            View Full Schedule
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20" data-testid="stat-card-today">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">Today's Sessions</p>
                <p className="text-3xl font-bold mt-2">{todaysSessions.length}</p>
                <p className="text-xs text-blue-200 mt-1">{format(now, "EEEE, MMM d")}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20" data-testid="stat-card-week">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-violet-100">This Week's Sessions</p>
                <p className="text-3xl font-bold mt-2">{thisWeekSessions.length}</p>
                <p className="text-xs text-violet-200 mt-1">{format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20" data-testid="stat-card-members">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">Total Members</p>
                <p className="text-3xl font-bold mt-2">{members?.length || 0}</p>
                <p className="text-xs text-emerald-200 mt-1">Active trainees</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-schedule">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-base font-semibold" data-testid="text-schedule-title">
              My Schedule
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {mySessions.length === 0 ? (
            <div className="text-center py-8" data-testid="text-no-sessions">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No sessions scheduled</p>
              <Link href="/schedule">
                <Button variant="outline" size="sm" className="mt-3" data-testid="button-add-session">
                  Add Session
                </Button>
              </Link>
            </div>
          ) : (
            <Table data-testid="table-schedule">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySessions.slice(0, 10).map((session) => (
                  <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-title-${session.id}`}>
                      {session.title}
                    </TableCell>
                    <TableCell data-testid={`cell-type-${session.id}`}>
                      <Badge
                        variant="secondary"
                        className={
                          session.type === "group"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                        }
                      >
                        {session.type}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-date-${session.id}`}>
                      {format(new Date(session.startTime), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`cell-time-${session.id}`}>
                      {format(new Date(session.startTime), "h:mm a")} – {format(new Date(session.endTime), "h:mm a")}
                    </TableCell>
                    <TableCell data-testid={`cell-capacity-${session.id}`}>
                      <span className="font-medium">{session.enrolled}</span>
                      <span className="text-muted-foreground">/{session.capacity}</span>
                    </TableCell>
                    <TableCell data-testid={`cell-status-${session.id}`}>
                      <Badge
                        className={
                          session.status === "scheduled"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : session.status === "completed"
                            ? "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        }
                        variant="secondary"
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-members">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-base font-semibold" data-testid="text-members-title">
              My Members
            </CardTitle>
            {members && members.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{members.length} total</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <div className="text-center py-8" data-testid="text-no-members">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No members assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.slice(0, 9).map((member, idx) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
                  data-testid={`card-member-${member.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`${avatarColors[idx % avatarColors.length]} text-white text-sm font-semibold`}>
                      {member.firstName[0]}{member.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" data-testid={`text-member-name-${member.id}`}>
                      {member.firstName} {member.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{member.membershipType}</span>
                      <Badge
                        variant="secondary"
                        className={
                          member.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] px-1.5 py-0"
                            : member.status === "expiring"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] px-1.5 py-0"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 text-[10px] px-1.5 py-0"
                        }
                      >
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {members && members.length > 9 && (
            <div className="mt-4 text-center">
              <Link href="/members">
                <Button variant="outline" size="sm" data-testid="button-view-all-members">
                  View All Members
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
