import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Users, Gift, Clock, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMarket } from "@/hooks/use-market";
import type { Referral, Member } from "@shared/schema";

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const createReferralSchema = z.object({
  referrerId: z.string().min(1, "Referrer is required"),
  referralCode: z.string().min(1, "Referral code is required"),
  rewardType: z.string().min(1, "Reward type is required"),
  rewardValue: z.string().min(1, "Reward value is required"),
});

export default function ReferralsPage() {
  const { fmt } = useMarket();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: referrals, isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const membersMap = useMemo(() => {
    const map = new Map<string, Member>();
    (members || []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const stats = useMemo(() => {
    const list = referrals || [];
    return {
      total: list.length,
      completed: list.filter((r) => r.status === "completed").length,
      pending: list.filter((r) => r.status === "pending").length,
      totalRewards: list
        .filter((r) => r.status === "completed" && r.rewardValue)
        .reduce((sum, r) => sum + parseFloat(r.rewardValue || "0"), 0),
    };
  }, [referrals]);

  const form = useForm({
    resolver: zodResolver(createReferralSchema),
    defaultValues: {
      referrerId: "",
      referralCode: generateReferralCode(),
      rewardType: "discount",
      rewardValue: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createReferralSchema>) => {
      const res = await apiRequest("POST", "/api/referrals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral created successfully" });
      form.reset({ referrerId: "", referralCode: generateReferralCode(), rewardType: "discount", rewardValue: "" });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create referral", description: error.message, variant: "destructive" });
    },
  });

  const statCards = [
    { title: "Total Referrals", value: stats.total, icon: Users },
    { title: "Completed", value: stats.completed, icon: CheckCircle },
    { title: "Pending", value: stats.pending, icon: Clock },
    { title: "Total Rewards", value: fmt(stats.totalRewards), icon: Gift },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="page-referrals">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-referrals-title">Referral Program</h1>
          <p className="text-muted-foreground mt-1">Track referrals and manage rewards</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-generate-referral">
              <Plus className="h-4 w-4 mr-2" />
              Generate Referral
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Referral</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="referrerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referrer (Member)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-referrer">
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(members || []).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.firstName} {m.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Code</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} readOnly data-testid="input-referral-code" />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("referralCode", generateReferralCode())}
                          data-testid="button-regenerate-code"
                        >
                          Regenerate
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rewardType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reward Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reward-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="discount">Discount</SelectItem>
                            <SelectItem value="free_days">Free Days</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rewardValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reward Value</FormLabel>
                        <FormControl>
                          <Input placeholder="10" type="number" {...field} data-testid="input-reward-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-referral"
                >
                  {createMutation.isPending ? "Creating..." : "Generate Referral"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {referralsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : !referrals || referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Gift className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No referrals yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">Generate your first referral code to start the program</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead className="hidden md:table-cell">Referred Member</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Reward Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Reward Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => {
                  const referrer = membersMap.get(referral.referrerId);
                  const referred = referral.referredMemberId ? membersMap.get(referral.referredMemberId) : null;
                  return (
                    <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-medium ${["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"][referral.referrerId.charCodeAt(0) % 8]}`}>
                            {referrer ? referrer.firstName.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="font-medium text-sm" data-testid={`text-referrer-${referral.id}`}>
                            {referrer ? `${referrer.firstName} ${referrer.lastName}` : "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {referred ? `${referred.firstName} ${referred.lastName}` : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm" data-testid={`text-referral-code-${referral.id}`}>
                          {referral.referralCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            referral.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : referral.status === "pending"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-red-100 text-red-700 border-red-200"
                          }
                          data-testid={`badge-referral-status-${referral.id}`}
                        >
                          {referral.status === "completed" ? "Completed" : referral.status === "pending" ? "Pending" : "Expired"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">
                        {referral.rewardType?.replace("_", " ") || "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground" data-testid={`text-reward-value-${referral.id}`}>
                        {referral.rewardValue ? fmt(referral.rewardValue) : "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {referral.createdAt ? format(new Date(referral.createdAt), "MMM d, yyyy") : "N/A"}
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
