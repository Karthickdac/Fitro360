import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, Shield, Clock, Activity, User, Calendar } from "lucide-react";
import { format, differenceInDays, differenceInMinutes } from "date-fns";
import type { Member, Attendance, TrainerSession } from "@shared/schema";

export default function MemberPortalPage() {
  const { user } = useAuth();

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const memberRecord = members?.find((m) => m.email === user?.email);

  const { data: allAttendance, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<TrainerSession[]>({
    queryKey: ["/api/sessions"],
  });

  const myAttendance = allAttendance?.filter((a) => a.memberId === memberRecord?.id) || [];
  const upcomingSessions = sessions?.filter(
    (s) => s.status === "scheduled" && new Date(s.startTime) >= new Date()
  ) || [];

  const daysRemaining = memberRecord?.membershipEnd
    ? Math.max(0, differenceInDays(new Date(memberRecord.membershipEnd), new Date()))
    : 0;

  const isLoading = membersLoading || attendanceLoading || sessionsLoading;

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="My Attendance"
          value={myAttendance.length}
          icon={CalendarCheck}
        />
        <StatCard
          title="Membership Status"
          value={memberRecord?.status ? memberRecord.status.charAt(0).toUpperCase() + memberRecord.status.slice(1) : "N/A"}
          icon={Shield}
        />
        <StatCard
          title="Days Remaining"
          value={daysRemaining}
          icon={Clock}
          subtitle={memberRecord?.membershipEnd ? `Expires ${format(new Date(memberRecord.membershipEnd), "MMM d, yyyy")}` : "No end date"}
        />
        <StatCard
          title="BMI"
          value={memberRecord?.bmi ? Number(memberRecord.bmi).toFixed(1) : "N/A"}
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold" data-testid="text-attendance-title">
            My Attendance History
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
                {myAttendance.slice(0, 10).map((record) => {
                  const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
                  const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
                  const duration = checkIn && checkOut ? differenceInMinutes(checkOut, checkIn) : null;
                  return (
                    <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                      <TableCell data-testid={`cell-date-${record.id}`}>
                        {checkIn ? format(checkIn, "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell data-testid={`cell-checkin-${record.id}`}>
                        {checkIn ? format(checkIn, "h:mm a") : "—"}
                      </TableCell>
                      <TableCell data-testid={`cell-checkout-${record.id}`}>
                        {checkOut ? format(checkOut, "h:mm a") : "—"}
                      </TableCell>
                      <TableCell data-testid={`cell-duration-${record.id}`}>
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
          <CardTitle className="text-base font-semibold" data-testid="text-sessions-title">
            Upcoming Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-sessions">
              No upcoming sessions
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingSessions.slice(0, 6).map((session) => (
                <Card key={session.id} data-testid={`card-session-${session.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-session-title-${session.id}`}>
                          {session.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(session.startTime), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.startTime), "h:mm a")} – {format(new Date(session.endTime), "h:mm a")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {session.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {session.enrolled}/{session.capacity} enrolled
                      </span>
                      <Badge
                        variant={session.status === "scheduled" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {session.status}
                      </Badge>
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
          <CardTitle className="text-base font-semibold" data-testid="text-profile-title">
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberRecord ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium" data-testid="text-profile-name">
                    {memberRecord.firstName} {memberRecord.lastName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium" data-testid="text-profile-email">
                    {memberRecord.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium" data-testid="text-profile-phone">
                    {memberRecord.phone || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Membership Type</p>
                  <p className="text-sm font-medium" data-testid="text-profile-membership">
                    {memberRecord.membershipType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium" data-testid="text-profile-start">
                    {memberRecord.membershipStart ? format(new Date(memberRecord.membershipStart), "MMM d, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium" data-testid="text-profile-end">
                    {memberRecord.membershipEnd ? format(new Date(memberRecord.membershipEnd), "MMM d, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-profile">
              No member profile found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
