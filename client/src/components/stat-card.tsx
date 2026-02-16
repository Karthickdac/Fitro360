import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  color?: "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan" | "indigo";
}

const colorMap = {
  blue: {
    card: "border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-blue-100",
    trend: "text-blue-100",
    label: "text-blue-200",
  },
  emerald: {
    card: "border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-emerald-100",
    trend: "text-emerald-100",
    label: "text-emerald-200",
  },
  violet: {
    card: "border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-violet-100",
    trend: "text-violet-100",
    label: "text-violet-200",
  },
  amber: {
    card: "border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-amber-100",
    trend: "text-amber-100",
    label: "text-amber-200",
  },
  rose: {
    card: "border-0 bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-rose-100",
    trend: "text-rose-100",
    label: "text-rose-200",
  },
  cyan: {
    card: "border-0 bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-lg shadow-cyan-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-cyan-100",
    trend: "text-cyan-100",
    label: "text-cyan-200",
  },
  indigo: {
    card: "border-0 bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-lg shadow-indigo-500/20",
    icon: "bg-white/20",
    iconText: "text-white",
    subtitle: "text-indigo-100",
    trend: "text-indigo-100",
    label: "text-indigo-200",
  },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, className, color }: StatCardProps) {
  if (color) {
    const c = colorMap[color];
    return (
      <Card className={`${c.card} ${className || ""}`} data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-1">
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-medium ${c.label}`}>{title}</span>
              <span className="text-3xl font-bold tracking-tight mt-1">{value}</span>
              {subtitle && (
                <span className={`text-xs mt-0.5 ${c.subtitle}`}>{subtitle}</span>
              )}
              {trend && (
                <span className={`text-xs font-medium mt-1 ${c.trend}`}>
                  {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
                </span>
              )}
            </div>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
              <Icon className={`h-6 w-6 ${c.iconText}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-muted-foreground font-medium">{title}</span>
            <span className="text-2xl font-bold tracking-tight mt-1">{value}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground mt-0.5">{subtitle}</span>
            )}
            {trend && (
              <span className={`text-xs font-medium mt-1 ${trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
              </span>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
