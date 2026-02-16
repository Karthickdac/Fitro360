import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Users, Clock, ArrowRight } from "lucide-react";
import { format, isToday, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Link } from "wouter";
import type { Member, TrainerSession } from "@shared/schema";

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

  return (
    <div className="p-6 space-y-6" data-testid="page-trainer-portal">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-trainer-welcome">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-trainer-subtitle">
          Here's your training overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Today's Sessions"
          value={todaysSessions.length}
          icon={Calendar}
        />
        <StatCard
          title="This Week's Sessions"
          value={thisWeekSessions.length}
          icon={Clock}
        />
        <StatCard
          title="Total Members"
          value={members?.length || 0}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold" data-testid="text-schedule-title">
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-sessions">
              No sessions scheduled
            </p>
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
                      <Badge variant="secondary">{session.type}</Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-date-${session.id}`}>
                      {format(new Date(session.startTime), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`cell-time-${session.id}`}>
                      {format(new Date(session.startTime), "h:mm a")} – {format(new Date(session.endTime), "h:mm a")}
                    </TableCell>
                    <TableCell data-testid={`cell-capacity-${session.id}`}>
                      {session.enrolled}/{session.capacity}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${session.id}`}>
                      <Badge
                        variant={session.status === "scheduled" ? "default" : session.status === "completed" ? "secondary" : "destructive"}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold" data-testid="text-members-title">
            Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-members">
              No members found
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.slice(0, 9).map((member) => (
                <Card key={member.id} data-testid={`card-member-${member.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" data-testid={`text-member-name-${member.id}`}>
                          {member.firstName} {member.lastName}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className="text-xs text-muted-foreground">{member.membershipType}</span>
                          <Badge
                            variant={member.status === "active" ? "default" : member.status === "expiring" ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold" data-testid="text-quick-actions-title">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/schedule">
            <Button data-testid="button-view-schedule">
              View Full Schedule
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
