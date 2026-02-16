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
import { Plus, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMarket } from "@/hooks/use-market";
import type { Coupon } from "@shared/schema";

function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const createCouponSchema = z.object({
  code: z.string().min(1, "Code is required"),
  description: z.string().optional(),
  discountType: z.string().min(1, "Discount type is required"),
  discountValue: z.string().min(1, "Discount value is required"),
  maxUses: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

function getCouponStatus(coupon: Coupon): "active" | "expired" | "used_up" {
  if (coupon.maxUses && (coupon.usedCount || 0) >= coupon.maxUses) return "used_up";
  if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) return "expired";
  if (!coupon.isActive) return "expired";
  return "active";
}

export default function CouponsPage() {
  const { fmt } = useMarket();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  const form = useForm({
    resolver: zodResolver(createCouponSchema),
    defaultValues: {
      code: generateCouponCode(),
      description: "",
      discountType: "percentage",
      discountValue: "",
      maxUses: "",
      validFrom: "",
      validUntil: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createCouponSchema>) => {
      const res = await apiRequest("POST", "/api/coupons", {
        ...data,
        maxUses: data.maxUses ? parseInt(data.maxUses) : undefined,
        validFrom: data.validFrom || undefined,
        validUntil: data.validUntil || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Coupon created successfully" });
      form.reset({ code: generateCouponCode(), description: "", discountType: "percentage", discountValue: "", maxUses: "", validFrom: "", validUntil: "" });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create coupon", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/coupons/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Coupon status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update coupon", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-coupons">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-coupons-title">Coupons & Promotions</h1>
          <p className="text-muted-foreground mt-1">Manage discount codes and promotional offers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-coupon">
              <Plus className="h-4 w-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coupon Code</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="SAVE20" {...field} data-testid="input-coupon-code" />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("code", generateCouponCode())}
                          data-testid="button-generate-code"
                        >
                          Generate
                        </Button>
                      </div>
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
                        <Input placeholder="20% off first month" {...field} data-testid="input-coupon-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-discount-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input placeholder="20" type="number" {...field} data-testid="input-discount-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Uses (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="100" type="number" {...field} data-testid="input-max-uses" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="validFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid From</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-valid-from" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-valid-until" />
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
                  data-testid="button-submit-coupon"
                >
                  {createMutation.isPending ? "Creating..." : "Create Coupon"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : !coupons || coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Tag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No coupons yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">Create your first coupon to start offering discounts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="hidden sm:table-cell">Max Uses</TableHead>
                  <TableHead className="hidden sm:table-cell">Used</TableHead>
                  <TableHead className="hidden lg:table-cell">Valid Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Toggle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.id}`}>
                      <TableCell>
                        <span className="font-mono font-medium text-sm" data-testid={`text-coupon-code-${coupon.id}`}>
                          {coupon.code}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {coupon.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${coupon.discountType === "percentage" ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-cyan-100 text-cyan-700 border-cyan-200"}`} data-testid={`text-coupon-discount-${coupon.id}`}>
                          {coupon.discountType === "percentage"
                            ? `${coupon.discountValue}%`
                            : fmt(coupon.discountValue || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {coupon.maxUses ?? "Unlimited"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground" data-testid={`text-coupon-used-${coupon.id}`}>
                        {coupon.usedCount || 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {coupon.validFrom ? format(new Date(coupon.validFrom), "MMM d, yyyy") : "N/A"}
                        {" - "}
                        {coupon.validUntil ? format(new Date(coupon.validUntil), "MMM d, yyyy") : "No end"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            status === "active"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : status === "used_up"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-red-100 text-red-700 border-red-200"
                          }
                          data-testid={`badge-coupon-status-${coupon.id}`}
                        >
                          {status === "active" ? "Active" : status === "used_up" ? "Used Up" : "Expired"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })}
                          disabled={toggleMutation.isPending}
                          data-testid={`button-toggle-coupon-${coupon.id}`}
                        >
                          {coupon.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
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
