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
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Users, MoreHorizontal, Snowflake, RefreshCw, Ruler, Download, UserCheck, Eraser, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMarket } from "@/hooks/use-market";
import { useLocation } from "wouter";
import { useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Member, User, MembershipPlan } from "@shared/schema";

const addMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  membershipPlanId: z.string().optional(),
  membershipType: z.string().default("monthly"),
  trainerId: z.string().optional(),
  salespersonId: z.string().optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  signatureDataUrl: z.string().optional(),
  waiverAccepted: z.boolean().default(false),
});

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const evt = "touches" in e ? e.touches[0] : e;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={140}
        className="w-full border border-border rounded-md bg-white touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        data-testid="signature-canvas"
      />
      <Button type="button" variant="outline" size="sm" onClick={clear} data-testid="button-clear-signature">
        <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
      </Button>
    </div>
  );
}

export default function MembersPage() {
  const { config } = useMarket();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [bmiDialogOpen, setBmiDialogOpen] = useState(false);
  const [bmiMember, setBmiMember] = useState<Member | null>(null);
  const [bmiHeight, setBmiHeight] = useState("");
  const [bmiWeight, setBmiWeight] = useState("");

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const { data: trainers } = useQuery<User[]>({
    queryKey: ["/api/trainers"],
  });

  const { data: salespeople } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: membershipPlans } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  const planMap = new Map((membershipPlans || []).map(p => [p.id, p]));

  const [assignTrainerDialogOpen, setAssignTrainerDialogOpen] = useState(false);
  const [assignTrainerMember, setAssignTrainerMember] = useState<Member | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>("");

  const assignTrainerMutation = useMutation({
    mutationFn: async ({ id, trainerId }: { id: string; trainerId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/members/${id}`, { trainerId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Trainer assigned successfully" });
      setAssignTrainerDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to assign trainer", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      membershipPlanId: "",
      membershipType: "monthly",
      trainerId: "",
      salespersonId: "",
      heightCm: "",
      weightKg: "",
      nationality: "",
      dateOfBirth: "",
      emergencyContactName: "",
      emergencyContact: "",
      emergencyContactRelation: "",
      signatureDataUrl: "",
      waiverAccepted: false,
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addMemberSchema>) => {
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
      );
      const res = await apiRequest("POST", "/api/members", cleaned);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Member added successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const freezeMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/members/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Membership status updated" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/members/${id}/renew`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Membership renewed successfully" });
    },
  });

  const updateBmiMutation = useMutation({
    mutationFn: async ({ id, heightCm, weightKg }: { id: string; heightCm: string; weightKg: string }) => {
      const res = await apiRequest("PATCH", `/api/members/${id}`, { heightCm, weightKg });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "BMI updated" });
      setBmiDialogOpen(false);
    },
  });

  const handleExport = async () => {
    try {
      const res = await fetch("/api/analytics/export?type=members", { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "members_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const filteredMembers = (members || []).filter((member) => {
    const matchesSearch =
      `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: members?.length || 0,
    active: members?.filter((m) => m.status === "active").length || 0,
    expired: members?.filter((m) => m.status === "expired").length || 0,
    frozen: members?.filter((m) => m.status === "frozen").length || 0,
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-members">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-1">Manage your gym members and memberships</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-members">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-member">
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>Fill in the details to register a new gym member.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => addMemberMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input placeholder="John" {...field} data-testid="input-first-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input placeholder="Doe" {...field} data-testid="input-last-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="john@example.com" type="email" {...field} data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder={config.phonePlaceholder} {...field} data-testid="input-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {(membershipPlans || []).filter(p => p.isActive !== false).length > 0 ? (
                    <FormField control={form.control} name="membershipPlanId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Plan</FormLabel>
                        <Select onValueChange={(v) => {
                          field.onChange(v);
                          const plan = (membershipPlans || []).find(p => p.id === v);
                          if (plan) form.setValue("membershipType", plan.durationType);
                        }} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-membership-plan"><SelectValue placeholder="Select plan" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(membershipPlans || []).filter(p => p.isActive !== false).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} - {p.price} {p.currency}/{p.durationType}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={form.control} name="membershipType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-membership-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                            <SelectItem value="day_pass">Day Pass</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="trainerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trainer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-trainer"><SelectValue placeholder="Optional" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(trainers || []).map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="salespersonId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salesperson</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-salesperson"><SelectValue placeholder="Who closed this sale" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(salespeople || []).filter(u => ["sales_executive", "manager", "gym_owner"].includes(u.role)).map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl><Input type="date" {...field} data-testid="input-dob" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationality</FormLabel>
                        <FormControl><Input placeholder="Indian, Emirati..." {...field} data-testid="input-nationality" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Emergency Contact</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input placeholder="Name" {...field} data-testid="input-emg-name" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input placeholder="Phone" {...field} data-testid="input-emg-phone" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emergencyContactRelation" render={({ field }) => (
                        <FormItem>
                          <FormControl><Input placeholder="Relation" {...field} data-testid="input-emg-relation" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
                    <FormLabel className="text-sm font-semibold">Liability Waiver & Signature</FormLabel>
                    <FormField control={form.control} name="signatureDataUrl" render={({ field }) => (
                      <FormItem>
                        <SignaturePad value={field.value || ""} onChange={field.onChange} />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="waiverAccepted" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-waiver" />
                        </FormControl>
                        <FormLabel className="text-xs text-muted-foreground font-normal cursor-pointer">
                          I accept the liability waiver, terms & conditions, and gym policies
                        </FormLabel>
                      </FormItem>
                    )} />
                  </div>

                  <Button type="submit" className="w-full" disabled={addMemberMutation.isPending} data-testid="button-submit-member">
                    {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "active", "expired", "frozen"] as const).map((status) => {
          const isSelected = statusFilter === status;
          const colorClass = status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
            status === "expired" ? "bg-red-100 text-red-700 border-red-200" :
            status === "frozen" ? "bg-sky-100 text-sky-700 border-sky-200" :
            "bg-blue-100 text-blue-700 border-blue-200";
          return (
            <Button
              key={status}
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter(status)}
              data-testid={`button-filter-${status}`}
              className={isSelected ? `border ${colorClass} font-semibold` : ""}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 text-xs opacity-70">{statusCounts[status]}</span>
            </Button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-members"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No members found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                {search ? "Try adjusting your search or filters" : "Get started by adding your first member"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Trainer</TableHead>
                  <TableHead className="hidden lg:table-cell">BMI</TableHead>
                  <TableHead className="hidden lg:table-cell">Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => {
                  const plan = member.membershipPlanId ? planMap.get(member.membershipPlanId) : null;
                  const planLabel = plan?.name || member.membershipType.replace("_", " ");
                  return (
                  <TableRow
                    key={member.id}
                    data-testid={`row-member-${member.id}`}
                    onClick={() => navigate(`/members/${member.id}`)}
                    className="cursor-pointer hover-elevate"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ${["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"][parseInt(member.id, 36) % 8]}`}>
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{member.firstName} {member.lastName}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={`capitalize border ${
                        member.membershipType === "annual" ? "bg-violet-100 text-violet-700 border-violet-200" :
                        member.membershipType === "quarterly" ? "bg-blue-100 text-blue-700 border-blue-200" :
                        member.membershipType === "monthly" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      }`} data-testid={`badge-plan-${member.id}`}>
                        {planLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {member.trainerId ? (
                        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                          <UserCheck className="h-3 w-3" />
                          {trainers?.find(t => t.id === member.trainerId)?.firstName || "Assigned"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {member.bmi ? (
                        <span className={`font-medium ${parseFloat(member.bmi) < 18.5 ? "text-blue-500" : parseFloat(member.bmi) < 25 ? "text-green-500" : parseFloat(member.bmi) < 30 ? "text-yellow-500" : "text-red-500"}`}>
                          {member.bmi}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {member.membershipEnd ? format(new Date(member.membershipEnd), "MMM d, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize border ${
                          member.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          member.status === "frozen" ? "bg-sky-100 text-sky-700 border-sky-200" :
                          member.status === "expiring" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-red-100 text-red-700 border-red-200"
                        }`}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-member-actions-${member.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => freezeMutation.mutate({ id: member.id, status: "frozen" })}
                              data-testid={`action-freeze-${member.id}`}
                            >
                              <Snowflake className="h-4 w-4 mr-2" />
                              Freeze Membership
                            </DropdownMenuItem>
                          )}
                          {member.status === "frozen" && (
                            <DropdownMenuItem
                              onClick={() => freezeMutation.mutate({ id: member.id, status: "active" })}
                              data-testid={`action-unfreeze-${member.id}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Unfreeze Membership
                            </DropdownMenuItem>
                          )}
                          {(member.status === "expired" || member.status === "active") && (
                            <DropdownMenuItem
                              onClick={() => renewMutation.mutate(member.id)}
                              data-testid={`action-renew-${member.id}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Renew Membership
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setAssignTrainerMember(member);
                              setSelectedTrainerId(member.trainerId || "");
                              setAssignTrainerDialogOpen(true);
                            }}
                            data-testid={`action-assign-trainer-${member.id}`}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Assign Trainer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setBmiMember(member);
                              setBmiHeight(member.heightCm || "");
                              setBmiWeight(member.weightKg || "");
                              setBmiDialogOpen(true);
                            }}
                            data-testid={`action-bmi-${member.id}`}
                          >
                            <Ruler className="h-4 w-4 mr-2" />
                            Update BMI
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignTrainerDialogOpen} onOpenChange={setAssignTrainerDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Trainer</DialogTitle>
            <DialogDescription>
              {assignTrainerMember ? `${assignTrainerMember.firstName} ${assignTrainerMember.lastName}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
              <SelectTrigger data-testid="select-assign-trainer">
                <SelectValue placeholder="Select a trainer" />
              </SelectTrigger>
              <SelectContent>
                {(trainers || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!selectedTrainerId || assignTrainerMutation.isPending}
                onClick={() => {
                  if (assignTrainerMember && selectedTrainerId) {
                    assignTrainerMutation.mutate({ id: assignTrainerMember.id, trainerId: selectedTrainerId });
                  }
                }}
                data-testid="button-save-trainer"
              >
                {assignTrainerMutation.isPending ? "Saving..." : "Assign"}
              </Button>
              {assignTrainerMember?.trainerId && (
                <Button
                  variant="outline"
                  disabled={assignTrainerMutation.isPending}
                  onClick={() => {
                    if (assignTrainerMember) {
                      assignTrainerMutation.mutate({ id: assignTrainerMember.id, trainerId: null });
                    }
                  }}
                  data-testid="button-remove-trainer"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bmiDialogOpen} onOpenChange={setBmiDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update BMI</DialogTitle>
            <DialogDescription>
              {bmiMember ? `${bmiMember.firstName} ${bmiMember.lastName}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Height (cm)</label>
                <Input
                  type="number"
                  value={bmiHeight}
                  onChange={(e) => setBmiHeight(e.target.value)}
                  placeholder="175"
                  data-testid="input-bmi-height"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Weight (kg)</label>
                <Input
                  type="number"
                  value={bmiWeight}
                  onChange={(e) => setBmiWeight(e.target.value)}
                  placeholder="70"
                  data-testid="input-bmi-weight"
                />
              </div>
            </div>
            {bmiHeight && bmiWeight && (
              <div className="p-3 rounded-md bg-muted text-center">
                <p className="text-sm text-muted-foreground">Calculated BMI</p>
                <p className="text-2xl font-bold">
                  {(parseFloat(bmiWeight) / Math.pow(parseFloat(bmiHeight) / 100, 2)).toFixed(1)}
                </p>
              </div>
            )}
            <Button
              className="w-full"
              disabled={!bmiHeight || !bmiWeight || updateBmiMutation.isPending}
              onClick={() => {
                if (bmiMember) {
                  updateBmiMutation.mutate({ id: bmiMember.id, heightCm: bmiHeight, weightKg: bmiWeight });
                }
              }}
              data-testid="button-save-bmi"
            >
              {updateBmiMutation.isPending ? "Saving..." : "Save BMI"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
