import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  UserCheck,
  Users,
  Clock,
  Timer,
  CalendarDays,
  LogOut,
  QrCode,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Attendance, Member } from "@shared/schema";

export default function CheckInPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [memberSearch, setMemberSearch] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [checkinMode, setCheckinMode] = useState<"search" | "qr">("search");
  const [qrInput, setQrInput] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogMemberId, setQrDialogMemberId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: attendanceList, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", `?date=${dateStr}`],
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const membersMap = useMemo(() => {
    const map = new Map<string, Member>();
    (members || []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return [];
    const q = memberSearch.toLowerCase();
    return (members || [])
      .filter(
        (m) =>
          m.status === "active" &&
          `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [members, memberSearch]);

  const checkInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("POST", "/api/attendance/checkin", {
        memberId,
        method: "manual",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Member checked in successfully" });
      setMemberSearch("");
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const res = await apiRequest("PATCH", `/api/attendance/${attendanceId}/checkout`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Member checked out successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-out failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const qrCheckInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("POST", "/api/attendance/qr-checkin", { memberId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "QR check-in successful" });
      setQrInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "QR check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQrCheckIn = () => {
    try {
      const parsed = JSON.parse(qrInput);
      if (!parsed.memberId) {
        toast({ title: "Invalid QR data", description: "Missing memberId", variant: "destructive" });
        return;
      }
      qrCheckInMutation.mutate(parsed.memberId);
    } catch {
      toast({ title: "Invalid QR data", description: "Could not parse QR code JSON", variant: "destructive" });
    }
  };

  const handleGenerateQr = async (memberId: string) => {
    setQrDialogMemberId(memberId);
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrImageUrl(null);
    try {
      const res = await apiRequest("GET", `/api/members/${memberId}/qrcode`);
      const data = await res.json();
      setQrImageUrl(data.qrCode);
    } catch {
      toast({ title: "Failed to generate QR code", variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  };

  const totalCheckIns = attendanceList?.length || 0;
  const currentlyIn = attendanceList?.filter((a) => !a.checkOutTime).length || 0;
  const avgDuration = useMemo(() => {
    const completed = (attendanceList || []).filter((a) => a.checkInTime && a.checkOutTime);
    if (completed.length === 0) return "N/A";
    const totalMs = completed.reduce((sum, a) => {
      const inTime = new Date(a.checkInTime!).getTime();
      const outTime = new Date(a.checkOutTime!).getTime();
      return sum + (outTime - inTime);
    }, 0);
    const avgMs = totalMs / completed.length;
    const mins = Math.round(avgMs / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }, [attendanceList]);

  function getDuration(a: Attendance) {
    if (!a.checkInTime) return "-";
    const inTime = new Date(a.checkInTime).getTime();
    const outTime = a.checkOutTime
      ? new Date(a.checkOutTime).getTime()
      : Date.now();
    const mins = Math.round((outTime - inTime) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  const qrDialogMember = qrDialogMemberId ? membersMap.get(qrDialogMemberId) : null;

  return (
    <div className="p-6 space-y-6" data-testid="page-check-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check-in</h1>
          <p className="text-muted-foreground mt-1">
            Manage member attendance and check-ins
          </p>
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="button-date-picker">
              <CalendarDays className="h-4 w-4 mr-2" />
              {format(selectedDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setCalendarOpen(false);
                }
              }}
              data-testid="calendar-date-picker"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Check-ins Today" value={totalCheckIns} icon={UserCheck} color="blue" />
        <StatCard title="Currently In Gym" value={currentlyIn} icon={Users} color="emerald" />
        <StatCard title="Average Duration" value={avgDuration} icon={Timer} color="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={checkinMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setCheckinMode("search")}
              data-testid="button-mode-search"
            >
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
            <Button
              variant={checkinMode === "qr" ? "default" : "outline"}
              size="sm"
              onClick={() => setCheckinMode("qr")}
              data-testid="button-mode-qr"
            >
              <QrCode className="h-4 w-4 mr-1" />
              QR Code
            </Button>
          </div>

          {checkinMode === "search" && (
            <>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search member by name..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-member-checkin"
                />
              </div>
              {filteredMembers.length > 0 && (
                <div className="border rounded-md divide-y">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 p-3"
                      data-testid={`row-search-member-${member.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-medium ${["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"][parseInt(member.id, 36) % 8]}`}>
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateQr(member.id)}
                          data-testid={`button-generate-qr-${member.id}`}
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          QR
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => checkInMutation.mutate(member.id)}
                          disabled={checkInMutation.isPending}
                          data-testid={`button-checkin-member-${member.id}`}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Check In
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {checkinMode === "qr" && (
            <div className="space-y-3 max-w-sm">
              <label className="text-sm font-medium" htmlFor="qr-scan-input">
                Scan QR Code
              </label>
              <Input
                id="qr-scan-input"
                placeholder='Paste QR code data here...'
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                data-testid="input-qr-scan"
              />
              <Button
                onClick={handleQrCheckIn}
                disabled={!qrInput.trim() || qrCheckInMutation.isPending}
                data-testid="button-qr-checkin"
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Check In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Attendance Log — {format(selectedDate, "MMMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {attendanceLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                <Clock className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No check-ins</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                No attendance records for this date
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Check-in</TableHead>
                  <TableHead className="hidden sm:table-cell">Check-out</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead className="hidden md:table-cell">Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceList.map((record) => {
                  const member = membersMap.get(record.memberId);
                  return (
                    <TableRow
                      key={record.id}
                      data-testid={`row-attendance-${record.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-medium ${["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"][parseInt(record.memberId, 36) % 8]}`}>
                            {member
                              ? `${member.firstName[0]}${member.lastName[0]}`
                              : "?"}
                          </div>
                          <span className="text-sm font-medium" data-testid={`text-attendance-member-${record.id}`}>
                            {member
                              ? `${member.firstName} ${member.lastName}`
                              : record.memberId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground" data-testid={`text-checkin-time-${record.id}`}>
                        {record.checkInTime
                          ? format(new Date(record.checkInTime), "h:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground" data-testid={`text-checkout-time-${record.id}`}>
                        {record.checkOutTime
                          ? format(new Date(record.checkOutTime), "h:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`capitalize ${record.method === "qr" ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-blue-100 text-blue-700 border-blue-200"}`} data-testid={`badge-method-${record.id}`}>
                          {record.method || "manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground" data-testid={`text-duration-${record.id}`}>
                        {getDuration(record)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={record.checkOutTime ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}>
                          {record.checkOutTime ? "Checked Out" : "Checked In"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!record.checkOutTime && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => checkOutMutation.mutate(record.id)}
                            disabled={checkOutMutation.isPending}
                            data-testid={`button-checkout-${record.id}`}
                          >
                            <LogOut className="h-3.5 w-3.5 mr-1" />
                            Out
                          </Button>
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

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent data-testid="dialog-qr-code">
          <DialogHeader>
            <DialogTitle data-testid="text-qr-dialog-title">
              {qrDialogMember
                ? `QR Code — ${qrDialogMember.firstName} ${qrDialogMember.lastName}`
                : "QR Code"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrLoading ? (
              <Skeleton className="h-[300px] w-[300px]" />
            ) : qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt="Member QR Code"
                className="w-[300px] h-[300px]"
                data-testid="img-qr-code"
              />
            ) : (
              <p className="text-muted-foreground text-sm">Failed to load QR code</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
