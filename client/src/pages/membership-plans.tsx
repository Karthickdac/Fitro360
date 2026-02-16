import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  CreditCard,
  Users,
  Star,
  Check,
  X,
  Pencil,
  Trash2,
  Crown,
  Dumbbell,
  Lock,
  Shirt,
  UserPlus,
  Clock,
  Snowflake,
  Ticket,
  TrendingUp,
  Eye,
  ToggleLeft,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMarket } from "@/hooks/use-market";
import { StatCard } from "@/components/stat-card";
import type { MembershipPlan, Member } from "@shared/schema";

const planFormSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  durationType: z.string().min(1, "Duration type is required"),
  durationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
  price: z.string().min(1, "Price is required"),
  currency: z.string().default("AED"),
  setupFee: z.string().optional(),
  features: z.string().optional(),
  maxFreezeDays: z.coerce.number().min(0).default(0),
  guestPasses: z.coerce.number().min(0).default(0),
  personalTrainerSessions: z.coerce.number().min(0).default(0),
  lockerAccess: z.boolean().default(false),
  towelService: z.boolean().default(false),
  groupClasses: z.boolean().default(false),
  personalTraining: z.boolean().default(false),
  color: z.string().default("#6366f1"),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().min(0).default(0),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

const durationPresets: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semi_annual: 180,
  annual: 365,
  custom: 30,
};

const durationLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
  custom: "Custom",
};

const colorOptions = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f97316", label: "Orange" },
  { value: "#14b8a6", label: "Teal" },
];

export default function MembershipPlansPage() {
  const { toast } = useToast();
  const { fmt, config } = useMarket();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [viewPlan, setViewPlan] = useState<MembershipPlan | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: plans, isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      description: "",
      durationType: "monthly",
      durationDays: 30,
      price: "",
      currency: config?.currency || "AED",
      setupFee: "0",
      features: "",
      maxFreezeDays: 0,
      guestPasses: 0,
      personalTrainerSessions: 0,
      lockerAccess: false,
      towelService: false,
      groupClasses: false,
      personalTraining: false,
      color: "#6366f1",
      isPopular: false,
      isActive: true,
      sortOrder: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlanFormValues) => {
      const payload = {
        ...data,
        features: data.features ? data.features.split(",").map((f) => f.trim()).filter(Boolean) : [],
      };
      if (editingPlan) {
        const res = await apiRequest("PATCH", `/api/membership-plans/${editingPlan.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/membership-plans", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({ title: editingPlan ? "Plan updated successfully" : "Plan created successfully" });
      form.reset();
      setDialogOpen(false);
      setEditingPlan(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/membership-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({ title: "Plan deactivated successfully" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/membership-plans/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({ title: "Plan status updated" });
    },
  });

  function openEdit(plan: MembershipPlan) {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      description: plan.description || "",
      durationType: plan.durationType,
      durationDays: plan.durationDays,
      price: String(plan.price),
      currency: plan.currency,
      setupFee: String(plan.setupFee || "0"),
      features: (plan.features || []).join(", "),
      maxFreezeDays: plan.maxFreezeDays || 0,
      guestPasses: plan.guestPasses || 0,
      personalTrainerSessions: plan.personalTrainerSessions || 0,
      lockerAccess: plan.lockerAccess || false,
      towelService: plan.towelService || false,
      groupClasses: plan.groupClasses || false,
      personalTraining: plan.personalTraining || false,
      color: plan.color || "#6366f1",
      isPopular: plan.isPopular || false,
      isActive: plan.isActive !== false,
      sortOrder: plan.sortOrder || 0,
    });
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingPlan(null);
    form.reset({
      name: "",
      description: "",
      durationType: "monthly",
      durationDays: 30,
      price: "",
      currency: config?.currency || "AED",
      setupFee: "0",
      features: "",
      maxFreezeDays: 0,
      guestPasses: 0,
      personalTrainerSessions: 0,
      lockerAccess: false,
      towelService: false,
      groupClasses: false,
      personalTraining: false,
      color: "#6366f1",
      isPopular: false,
      isActive: true,
      sortOrder: 0,
    });
    setDialogOpen(true);
  }

  const activePlans = (plans || []).filter((p) => p.isActive !== false);
  const inactivePlans = (plans || []).filter((p) => p.isActive === false);
  const filteredPlans = activeTab === "active" ? activePlans : activeTab === "inactive" ? inactivePlans : plans || [];

  const getMemberCountForPlan = (planId: string) => {
    return (members || []).filter((m) => m.membershipPlanId === planId).length;
  };

  const totalRevenue = activePlans.reduce((sum, p) => {
    const count = getMemberCountForPlan(p.id);
    return sum + count * parseFloat(String(p.price));
  }, 0);

  const totalMembers = activePlans.reduce((sum, p) => sum + getMemberCountForPlan(p.id), 0);
  const popularPlan = activePlans.find((p) => p.isPopular);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="membership-plans-loading">
        <div><h1 className="text-2xl font-bold tracking-tight">Membership Plans</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-32" />))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-64" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-membership-plans">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membership Plans</h1>
          <p className="text-muted-foreground mt-1">Create and manage membership plans for your gym</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Plans" value={activePlans.length} icon={CreditCard} color="blue" subtitle={`${inactivePlans.length} inactive`} data-testid="stat-total-plans" />
        <StatCard title="Active Members" value={totalMembers} icon={Users} color="emerald" subtitle="On active plans" data-testid="stat-total-members" />
        <StatCard title="Monthly Revenue" value={fmt(totalRevenue)} icon={TrendingUp} color="violet" subtitle="From all plans" data-testid="stat-monthly-revenue" />
        <StatCard title="Popular Plan" value={popularPlan?.name || "None set"} icon={Star} color="amber" subtitle={popularPlan ? fmt(parseFloat(String(popularPlan.price))) : "Mark a plan as popular"} data-testid="stat-popular-plan" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-plan-filter">
          <TabsTrigger value="all" data-testid="tab-all">All ({(plans || []).length})</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">Active ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">Inactive ({inactivePlans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredPlans.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No plans found</h3>
                <p className="text-muted-foreground mb-4">Create your first membership plan to get started</p>
                <Button onClick={openCreate} data-testid="button-create-first-plan">
                  <Plus className="h-4 w-4 mr-2" /> Create Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                const memberCount = getMemberCountForPlan(plan.id);
                return (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden transition-all hover:shadow-lg ${plan.isActive === false ? "opacity-60" : ""}`}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: plan.color || "#6366f1" }} />
                    {plan.isPopular && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" data-testid={`badge-popular-${plan.id}`}>
                          <Star className="h-3 w-3 mr-1 fill-current" /> Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pt-6 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-plan-desc-${plan.id}`}>{plan.description}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold" style={{ color: plan.color || "#6366f1" }} data-testid={`text-plan-price-${plan.id}`}>
                          {fmt(parseFloat(String(plan.price)))}
                        </span>
                        <span className="text-muted-foreground">/ {durationLabels[plan.durationType] || plan.durationType}</span>
                      </div>

                      {parseFloat(String(plan.setupFee || "0")) > 0 && (
                        <p className="text-sm text-muted-foreground">
                          + {fmt(parseFloat(String(plan.setupFee)))} setup fee
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span data-testid={`text-member-count-${plan.id}`}>{memberCount} active member{memberCount !== 1 ? "s" : ""}</span>
                      </div>

                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perks & Access</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <PerkItem active={plan.groupClasses || false} label="Group Classes" icon={<Dumbbell className="h-3.5 w-3.5" />} />
                          <PerkItem active={plan.personalTraining || false} label="Personal Training" icon={<UserPlus className="h-3.5 w-3.5" />} />
                          <PerkItem active={plan.lockerAccess || false} label="Locker Access" icon={<Lock className="h-3.5 w-3.5" />} />
                          <PerkItem active={plan.towelService || false} label="Towel Service" icon={<Shirt className="h-3.5 w-3.5" />} />
                        </div>
                        {(plan.maxFreezeDays || 0) > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Snowflake className="h-3.5 w-3.5 text-blue-500" />
                            <span>{plan.maxFreezeDays} freeze days</span>
                          </div>
                        )}
                        {(plan.guestPasses || 0) > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Ticket className="h-3.5 w-3.5 text-purple-500" />
                            <span>{plan.guestPasses} guest passes</span>
                          </div>
                        )}
                        {(plan.personalTrainerSessions || 0) > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <UserPlus className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{plan.personalTrainerSessions} PT sessions included</span>
                          </div>
                        )}
                      </div>

                      {(plan.features || []).length > 0 && (
                        <div className="space-y-1.5 border-t pt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
                          {(plan.features || []).map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => setViewPlan(plan)} data-testid={`button-view-plan-${plan.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(plan)} data-testid={`button-edit-plan-${plan.id}`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMutation.mutate({ id: plan.id, isActive: !plan.isActive })}
                          data-testid={`button-toggle-plan-${plan.id}`}
                        >
                          <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                          {plan.isActive !== false ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewPlan} onOpenChange={() => setViewPlan(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewPlan?.name} - Plan Details</DialogTitle>
            <DialogDescription>Full details of the membership plan</DialogDescription>
          </DialogHeader>
          {viewPlan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Price</p><p className="font-semibold">{fmt(parseFloat(String(viewPlan.price)))}</p></div>
                <div><p className="text-muted-foreground">Duration</p><p className="font-semibold">{viewPlan.durationDays} days ({durationLabels[viewPlan.durationType]})</p></div>
                <div><p className="text-muted-foreground">Setup Fee</p><p className="font-semibold">{fmt(parseFloat(String(viewPlan.setupFee || "0")))}</p></div>
                <div><p className="text-muted-foreground">Currency</p><p className="font-semibold">{viewPlan.currency}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={viewPlan.isActive ? "default" : "secondary"}>{viewPlan.isActive ? "Active" : "Inactive"}</Badge></div>
                <div><p className="text-muted-foreground">Members</p><p className="font-semibold">{getMemberCountForPlan(viewPlan.id)}</p></div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">Perks & Limits</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-blue-500" /> Freeze Days: {viewPlan.maxFreezeDays || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-purple-500" /> Guest Passes: {viewPlan.guestPasses || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-emerald-500" /> PT Sessions: {viewPlan.personalTrainerSessions || 0}
                  </div>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">Access</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <PerkItem active={viewPlan.groupClasses || false} label="Group Classes" icon={<Dumbbell className="h-4 w-4" />} />
                  <PerkItem active={viewPlan.personalTraining || false} label="Personal Training" icon={<UserPlus className="h-4 w-4" />} />
                  <PerkItem active={viewPlan.lockerAccess || false} label="Locker Access" icon={<Lock className="h-4 w-4" />} />
                  <PerkItem active={viewPlan.towelService || false} label="Towel Service" icon={<Shirt className="h-4 w-4" />} />
                </div>
              </div>
              {(viewPlan.features || []).length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-sm font-semibold mb-2">Features</p>
                  <div className="space-y-1">
                    {(viewPlan.features || []).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlan(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Update the membership plan details" : "Set up a new membership plan for your gym"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Gold Membership" {...field} data-testid="input-plan-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Color</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan-color">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: field.value }} />
                              <SelectValue placeholder="Select color" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colorOptions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }} />
                                {c.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the plan..." {...field} data-testid="input-plan-description" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="durationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration Type</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          if (v !== "custom") form.setValue("durationDays", durationPresets[v]);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-duration-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(durationLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-duration-days" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ({config?.currency || "AED"})</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-plan-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="setupFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Setup Fee</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-setup-fee" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-sort-order" />
                      </FormControl>
                      <FormDescription>Lower numbers appear first</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Perks & Limits</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="maxFreezeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Freeze Days</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} data-testid="input-freeze-days" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="guestPasses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Passes</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} data-testid="input-guest-passes" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personalTrainerSessions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PT Sessions Included</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} data-testid="input-pt-sessions" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Access & Amenities</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="groupClasses"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="h-4 w-4 text-muted-foreground" />
                          <FormLabel className="!mt-0">Group Classes</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-group-classes" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personalTraining"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                          <FormLabel className="!mt-0">Personal Training</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-personal-training" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lockerAccess"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <FormLabel className="!mt-0">Locker Access</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-locker-access" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="towelService"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Shirt className="h-4 w-4 text-muted-foreground" />
                          <FormLabel className="!mt-0">Towel Service</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-towel-service" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Features</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Comma-separated list, e.g. WiFi, Sauna, Swimming Pool, Juice Bar" {...field} data-testid="input-features" />
                    </FormControl>
                    <FormDescription>Separate features with commas</FormDescription>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <FormField
                  control={form.control}
                  name="isPopular"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-popular" />
                      </FormControl>
                      <FormLabel className="!mt-0 flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-500" /> Mark as Popular
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-active" />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-plan">
                {createMutation.isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerkItem({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 text-sm ${active ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>
      {active ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-red-300 shrink-0" />}
      {label}
    </div>
  );
}
