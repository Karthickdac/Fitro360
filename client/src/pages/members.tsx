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
import { Plus, Search, Users, MoreHorizontal, Snowflake, RefreshCw, Ruler, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Member } from "@shared/schema";

const addMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  membershipType: z.string().min(1, "Membership type is required"),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
});

export default function MembersPage() {
  const { toast } = useToast();
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

  const form = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      membershipType: "monthly",
      heightCm: "",
      weightKg: "",
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addMemberSchema>) => {
      const res = await apiRequest("POST", "/api/members", data);
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
                      <FormControl><Input placeholder="+971 50 123 4567" {...field} data-testid="input-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="heightCm" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (cm)</FormLabel>
                        <FormControl><Input type="number" placeholder="175" {...field} data-testid="input-height" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="weightKg" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg)</FormLabel>
                        <FormControl><Input type="number" placeholder="70" {...field} data-testid="input-weight" /></FormControl>
                        <FormMessage />
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

      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "active", "expired", "frozen"] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter(status)}
            data-testid={`button-filter-${status}`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">{statusCounts[status]}</span>
          </Button>
        ))}
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
                  <TableHead className="hidden sm:table-cell">Membership</TableHead>
                  <TableHead className="hidden lg:table-cell">BMI</TableHead>
                  <TableHead className="hidden lg:table-cell">Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="capitalize">
                        {member.membershipType.replace("_", " ")}
                      </Badge>
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
                        variant={
                          member.status === "active" ? "default"
                            : member.status === "frozen" ? "secondary"
                              : "destructive"
                        }
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
