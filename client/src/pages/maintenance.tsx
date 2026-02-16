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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Wrench, AlertTriangle, ClipboardList, Clock, CheckCircle2, Play } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { useMarket } from "@/hooks/use-market";
import type { EquipmentMaintenance, Equipment } from "@shared/schema";

const maintenanceTypes = ["routine", "repair", "inspection", "replacement"] as const;

const scheduleSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  type: z.string().min(1, "Type is required"),
  description: z.string().min(1, "Description is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  cost: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; className: string }> = {
  scheduled: { label: "Scheduled", variant: "default", className: "bg-blue-600 text-white no-default-hover-elevate no-default-active-elevate" },
  in_progress: { label: "In Progress", variant: "default", className: "bg-yellow-600 text-white no-default-hover-elevate no-default-active-elevate" },
  completed: { label: "Completed", variant: "default", className: "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" },
  cancelled: { label: "Cancelled", variant: "destructive", className: "" },
};

const typeLabels: Record<string, string> = {
  routine: "Routine",
  repair: "Repair",
  inspection: "Inspection",
  replacement: "Replacement",
};

export default function MaintenancePage() {
  const { fmt } = useMarket();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EquipmentMaintenance | null>(null);

  const { data: records, isLoading } = useQuery<EquipmentMaintenance[]>({
    queryKey: ["/api/maintenance"],
  });

  const { data: equipmentList } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      equipmentId: "",
      type: "",
      description: "",
      scheduledDate: "",
      cost: "",
      assignedTo: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ScheduleFormValues) => {
      const res = await apiRequest("POST", "/api/maintenance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({ title: "Maintenance scheduled successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to schedule maintenance", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/maintenance/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({ title: "Maintenance record updated" });
      setEditingRecord(null);
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update record", description: error.message, variant: "destructive" });
    },
  });

  const items = records || [];
  const equipMap = new Map((equipmentList || []).map((e) => [e.id, e.name]));

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const scheduled = items.filter((r) => r.status === "scheduled");
  const inProgress = items.filter((r) => r.status === "in_progress");
  const overdue = items.filter((r) => {
    if (r.status !== "scheduled") return false;
    const sd = new Date(r.scheduledDate);
    return sd < today;
  });

  function openEdit(record: EquipmentMaintenance) {
    setEditingRecord(record);
    form.reset({
      equipmentId: record.equipmentId,
      type: record.type,
      description: record.description,
      scheduledDate: record.scheduledDate ? format(new Date(record.scheduledDate), "yyyy-MM-dd") : "",
      cost: record.cost || "",
      assignedTo: record.assignedTo || "",
      notes: record.notes || "",
    });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingRecord(null);
    form.reset({
      equipmentId: "",
      type: "",
      description: "",
      scheduledDate: "",
      cost: "",
      assignedTo: "",
      notes: "",
    });
    setDialogOpen(true);
  }

  function onSubmit(data: ScheduleFormValues) {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-maintenance">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment Maintenance</h1>
          <p className="text-muted-foreground mt-1">Schedule and track equipment maintenance</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingRecord(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-maintenance" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Edit Maintenance" : "Schedule Maintenance"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="equipmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-equipment">
                            <SelectValue placeholder="Select equipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(equipmentList || []).map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-maintenance-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {maintenanceTypes.map((t) => (
                            <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Describe the maintenance task" {...field} data-testid="input-maintenance-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-scheduled-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-maintenance-cost" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <FormControl>
                          <Input placeholder="Technician name" {...field} data-testid="input-assigned-to" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Additional notes" {...field} data-testid="input-maintenance-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-maintenance"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? "Saving..."
                    : editingRecord ? "Update Record" : "Schedule Maintenance"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Records" value={items.length} icon={ClipboardList} />
          <StatCard title="Scheduled" value={scheduled.length} icon={Clock} />
          <StatCard title="In Progress" value={inProgress.length} icon={Play} />
          <StatCard title="Overdue" value={overdue.length} icon={AlertTriangle} />
        </div>
      )}

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4" data-testid="alert-overdue">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-medium">Overdue Maintenance</p>
            <p className="text-xs text-muted-foreground">
              {overdue.length} maintenance task{overdue.length > 1 ? "s" : ""} past scheduled date:{" "}
              {overdue.map((r) => equipMap.get(r.equipmentId) || "Unknown").join(", ")}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No maintenance records</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Get started by scheduling your first maintenance task
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Assigned To</TableHead>
                  <TableHead className="hidden lg:table-cell">Cost</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((record) => {
                  const cfg = statusConfig[record.status] || statusConfig.scheduled;
                  return (
                    <TableRow key={record.id} data-testid={`row-maintenance-${record.id}`}>
                      <TableCell className="font-medium text-sm" data-testid={`text-equipment-name-${record.id}`}>
                        {equipMap.get(record.equipmentId) || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {typeLabels[record.type] || record.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                        {record.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-scheduled-date-${record.id}`}>
                        {record.scheduledDate ? format(new Date(record.scheduledDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className={cfg.className} data-testid={`badge-status-${record.id}`}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {record.assignedTo || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {record.cost ? fmt(record.cost) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {record.status === "scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMutation.mutate({ id: record.id, data: { status: "in_progress" } })}
                              disabled={updateMutation.isPending}
                              data-testid={`button-start-${record.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          {(record.status === "scheduled" || record.status === "in_progress") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMutation.mutate({ id: record.id, data: { status: "completed", completedDate: new Date().toISOString() } })}
                              disabled={updateMutation.isPending}
                              data-testid={`button-complete-${record.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Done
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(record)}
                            data-testid={`button-edit-${record.id}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
