import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Star, Zap, Crown, Plus, Pencil, Trash2, Eye, Users, DollarSign, Package } from "lucide-react";
import type { SubscriptionPlan } from "@shared/schema";

type PlanFormData = {
  name: string;
  priceMonthly: string;
  priceAnnual: string;
  maxMembers: string;
  features: string;
  isPopular: boolean;
  isActive: boolean;
};

const defaultFormData: PlanFormData = {
  name: "",
  priceMonthly: "",
  priceAnnual: "",
  maxMembers: "",
  features: "",
  isPopular: false,
  isActive: true,
};

export default function PlansPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData);

  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/plans", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setShowCreateDialog(false);
      setFormData(defaultFormData);
      toast({ title: "Plan created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/plans/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setEditingPlan(null);
      setFormData(defaultFormData);
      toast({ title: "Plan updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/plans/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setDeletingPlan(null);
      toast({ title: "Plan deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const featuresArray = formData.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const payload = {
      name: formData.name,
      priceMonthly: formData.priceMonthly,
      priceAnnual: formData.priceAnnual,
      maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : null,
      features: featuresArray,
      isPopular: formData.isPopular,
      isActive: formData.isActive,
    };
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setFormData({
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceAnnual: plan.priceAnnual,
      maxMembers: plan.maxMembers?.toString() || "",
      features: (plan.features as string[] || []).join("\n"),
      isPopular: plan.isPopular || false,
      isActive: plan.isActive || true,
    });
    setEditingPlan(plan);
  };

  const openCreateDialog = () => {
    setFormData(defaultFormData);
    setShowCreateDialog(true);
  };

  const activePlans = (plans || []).filter((p) => p.isActive);
  const totalGyms = 3;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="plans-loading">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">Manage your SaaS pricing plans</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-24 mb-4" />
                <Skeleton className="h-10 w-20 mb-6" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const planColorMap: Record<string, { gradient: string; badge: string; check: string; price: string; ring: string }> = {
    basic: {
      gradient: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      check: "text-blue-500",
      price: "text-blue-600 dark:text-blue-400",
      ring: "",
    },
    pro: {
      gradient: "bg-gradient-to-br from-cyan-50 to-teal-100/50 dark:from-cyan-950/30 dark:to-teal-900/20",
      badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
      check: "text-cyan-500",
      price: "text-cyan-600 dark:text-cyan-400",
      ring: "",
    },
    enterprise: {
      gradient: "bg-gradient-to-br from-violet-50 to-purple-100/50 dark:from-violet-950/30 dark:to-purple-900/20",
      badge: "bg-violet-100 text-violet-700 border-violet-200",
      check: "text-violet-500",
      price: "text-violet-600 dark:text-violet-400",
      ring: "ring-2 ring-violet-400",
    },
  };

  const getColors = (name: string) => planColorMap[name.toLowerCase()] || {
    gradient: "bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/30 dark:to-orange-900/20",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    check: "text-amber-500",
    price: "text-amber-600 dark:text-amber-400",
    ring: "",
  };

  const getPlanIcon = (name: string) => {
    if (name.toLowerCase() === "enterprise") return Crown;
    if (name.toLowerCase() === "pro") return Zap;
    return Star;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-plans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">Configure pricing and features for gym owner plans</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Plans</p>
              <p className="text-xl font-bold" data-testid="stat-total-plans">{(plans || []).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Plans</p>
              <p className="text-xl font-bold" data-testid="stat-active-plans">{activePlans.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subscribed Gyms</p>
              <p className="text-xl font-bold" data-testid="stat-subscribed-gyms">{totalGyms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price Range</p>
              <p className="text-xl font-bold" data-testid="stat-price-range">
                {activePlans.length > 0
                  ? `$${Math.min(...activePlans.map((p) => Number(p.priceMonthly)))} - $${Math.max(...activePlans.map((p) => Number(p.priceMonthly)))}`
                  : "$0"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(plans || []).map((plan) => {
          const colors = getColors(plan.name);
          const PlanIcon = getPlanIcon(plan.name);
          return (
            <Card
              key={plan.id}
              className={`relative ${colors.gradient} ${plan.isPopular ? colors.ring : ""} ${!plan.isActive ? "opacity-60" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className={`gap-1 ${colors.badge}`}>
                    <Star className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              {!plan.isActive && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
              <CardContent className="p-6 pt-8">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <PlanIcon className={`h-5 w-5 ${colors.check}`} />
                    <h3 className="text-lg font-semibold capitalize" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h3>
                  </div>
                  <div className="mt-3">
                    <span className={`text-4xl font-bold ${colors.price}`} data-testid={`text-plan-price-${plan.id}`}>${plan.priceMonthly}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${plan.priceAnnual}/year (save {Math.round((1 - Number(plan.priceAnnual) / (Number(plan.priceMonthly) * 12)) * 100)}%)
                  </p>
                  {plan.maxMembers && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Up to {plan.maxMembers.toLocaleString()} members
                    </p>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {(plan.features as string[] || []).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${colors.check}`} />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setViewingPlan(plan)}
                    data-testid={`button-view-plan-${plan.id}`}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(plan)}
                    data-testid={`button-edit-plan-${plan.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingPlan(plan)}
                    data-testid={`button-delete-plan-${plan.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreateDialog || !!editingPlan} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingPlan(null); setFormData(defaultFormData); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
            <DialogDescription>{editingPlan ? "Update the subscription plan details" : "Add a new subscription plan for gym owners"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="plan-name">Plan Name</Label>
              <Input
                id="plan-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Basic, Pro, Enterprise"
                data-testid="input-plan-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price-monthly">Monthly Price ($)</Label>
                <Input
                  id="price-monthly"
                  type="number"
                  step="0.01"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  placeholder="29.00"
                  data-testid="input-price-monthly"
                />
              </div>
              <div>
                <Label htmlFor="price-annual">Annual Price ($)</Label>
                <Input
                  id="price-annual"
                  type="number"
                  step="0.01"
                  value={formData.priceAnnual}
                  onChange={(e) => setFormData({ ...formData, priceAnnual: e.target.value })}
                  placeholder="290.00"
                  data-testid="input-price-annual"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="max-members">Max Members</Label>
              <Input
                id="max-members"
                type="number"
                value={formData.maxMembers}
                onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
                placeholder="e.g. 100, 500, 5000"
                data-testid="input-max-members"
              />
            </div>
            <div>
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder={"Web admin panel\nMember management\nBasic reporting\nEmail support"}
                rows={6}
                data-testid="input-features"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-popular">Mark as Popular</Label>
              <Switch
                id="is-popular"
                checked={formData.isPopular}
                onCheckedChange={(checked) => setFormData({ ...formData, isPopular: checked })}
                data-testid="switch-popular"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Active</Label>
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingPlan(null); setFormData(defaultFormData); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.priceMonthly || !formData.priceAnnual || createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-plan"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingPlan} onOpenChange={(open) => { if (!open) setViewingPlan(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{viewingPlan?.name} Plan</DialogTitle>
            <DialogDescription>Subscription plan details</DialogDescription>
          </DialogHeader>
          {viewingPlan && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Monthly Price</p>
                  <p className="font-semibold text-lg">${viewingPlan.priceMonthly}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Annual Price</p>
                  <p className="font-semibold text-lg">${viewingPlan.priceAnnual}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Members</p>
                  <p className="font-semibold">{viewingPlan.maxMembers?.toLocaleString() || "Unlimited"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={viewingPlan.isActive ? "default" : "secondary"}>
                    {viewingPlan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              {viewingPlan.isPopular && (
                <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-700 border-amber-200">
                  <Star className="h-3 w-3" /> Most Popular
                </Badge>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Features</p>
                <div className="space-y-2">
                  {(viewingPlan.features as string[] || []).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingPlan} onOpenChange={(open) => { if (!open) setDeletingPlan(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <span className="font-semibold capitalize">{deletingPlan?.name}</span> plan? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPlan(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingPlan && deleteMutation.mutate(deletingPlan.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
