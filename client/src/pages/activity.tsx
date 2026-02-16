import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, UserPlus, RefreshCw, CreditCard, LogIn } from "lucide-react";
import { format } from "date-fns";
import type { Activity as ActivityType } from "@shared/schema";

const iconMap: Record<string, typeof Activity> = {
  member_added: UserPlus,
  member_renewed: RefreshCw,
  payment: CreditCard,
  check_in: LogIn,
};

export default function ActivityPage() {
  const { data: activities, isLoading } = useQuery<ActivityType[]>({
    queryKey: ["/api/activities"],
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-activity">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground mt-1">Track all actions and events in your gym</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (!activities || activities.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No activity yet</h3>
              <p className="text-muted-foreground mt-1">Actions and events will be logged here</p>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((activity) => {
                const Icon = iconMap[activity.type] || Activity;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-4"
                    data-testid={`activity-item-${activity.id}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.createdAt ? format(new Date(activity.createdAt), "MMMM d, yyyy 'at' h:mm a") : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
