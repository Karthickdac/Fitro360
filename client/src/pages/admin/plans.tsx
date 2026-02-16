import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star } from "lucide-react";
import type { SubscriptionPlan } from "@shared/schema";

export default function PlansPage() {
  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
  });

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

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-plans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
        <p className="text-muted-foreground mt-1">Configure pricing and features for each plan tier</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(plans || []).map((plan) => (
          <Card
            key={plan.id}
            className={plan.isPopular ? "ring-2 ring-primary relative" : ""}
            data-testid={`card-plan-${plan.name.toLowerCase()}`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="gap-1">
                  <Star className="h-3 w-3" />
                  Most Popular
                </Badge>
              </div>
            )}
            <CardContent className="p-6 pt-8">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold capitalize">{plan.name}</h3>
                <div className="mt-3">
                  <span className="text-4xl font-bold">${plan.priceMonthly}</span>
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
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                variant={plan.isPopular ? "default" : "secondary"}
                className="w-full"
                data-testid={`button-select-plan-${plan.name.toLowerCase()}`}
              >
                {plan.isPopular ? "Current Default" : "Select Plan"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
