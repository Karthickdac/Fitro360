import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Package, MoreHorizontal, Trash2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { useMarket } from "@/hooks/use-market";

type FixedAsset = {
  id: string;
  assetCode: string | null;
  name: string;
  category: string;
  location: string | null;
  vendorName: string | null;
  vendorContact: string | null;
  purchaseDate: string | null;
  purchaseValue: string | null;
  warrantyExpiry: string | null;
  amcExpiry: string | null;
  serialNumber: string | null;
  status: string;
  notes: string | null;
};

const formSchema = z.object({
  assetCode: z.string().optional(),
  name: z.string().min(1, "Asset name required"),
  category: z.string().default("equipment"),
  location: z.string().optional(),
  vendorName: z.string().optional(),
  vendorContact: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseValue: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  amcExpiry: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

const categoryColors: Record<string, string> = {
  equipment: "bg-blue-100 text-blue-700 border-blue-200",
  furniture: "bg-amber-100 text-amber-700 border-amber-200",
  electronics: "bg-violet-100 text-violet-700 border-violet-200",
  vehicle: "bg-emerald-100 text-emerald-700 border-emerald-200",
  building: "bg-cyan-100 text-cyan-700 border-cyan-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  maintenance: "bg-amber-100 text-amber-700 border-amber-200",
  retired: "bg-gray-100 text-gray-700 border-gray-200",
  disposed: "bg-red-100 text-red-700 border-red-200",
};

export default function FixedAssetsPage() {
  const { fmt } = useMarket();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: assets, isLoading } = useQuery<FixedAsset[]>({
    queryKey: ["/api/fixed-assets"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetCode: "", name: "", category: "equipment", location: "",
      vendorName: "", vendorContact: "", purchaseDate: "", purchaseValue: "",
      warrantyExpiry: "", amcExpiry: "", serialNumber: "", status: "active", notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
      );
      const res = await apiRequest("POST", "/api/fixed-assets", cleaned);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Asset added" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fixed-assets/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "Asset deleted" });
    },
  });

  const filtered = (assets || []).filter(a => {
    const matchesSearch = `${a.name} ${a.assetCode || ""} ${a.serialNumber || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValue = (assets || []).reduce((sum, a) => sum + Number(a.purchaseValue || 0), 0);
  const expiringWarranties = (assets || []).filter(a => {
    if (!a.warrantyExpiry) return false;
    const days = differenceInDays(parseISO(a.warrantyExpiry), new Date());
    return days >= 0 && days <= 30;
  }).length;
  const expiringAmc = (assets || []).filter(a => {
    if (!a.amcExpiry) return false;
    const days = differenceInDays(parseISO(a.amcExpiry), new Date());
    return days >= 0 && days <= 30;
  }).length;

  return (
    <div className="p-6 space-y-6" data-testid="page-fixed-assets">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fixed Asset Register</h1>
          <p className="text-muted-foreground mt-1">Track equipment, furniture, electronics, vehicles & their warranties</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-asset">
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Fixed Asset</DialogTitle>
              <DialogDescription>Register a new asset with vendor & warranty details.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name *</FormLabel>
                      <FormControl><Input placeholder="Treadmill X100" {...field} data-testid="input-asset-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="assetCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Code</FormLabel>
                      <FormControl><Input placeholder="FA-0001" {...field} data-testid="input-asset-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="equipment">Gym Equipment</SelectItem>
                          <SelectItem value="furniture">Furniture</SelectItem>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="vehicle">Vehicle</SelectItem>
                          <SelectItem value="building">Building / Fitout</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl><Input placeholder="Cardio area, Floor 1" {...field} data-testid="input-location" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vendorName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl><Input placeholder="Life Fitness" {...field} data-testid="input-vendor" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vendorContact" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Contact</FormLabel>
                      <FormControl><Input placeholder="+971 50 123 4567" {...field} data-testid="input-vendor-contact" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-purchase-date" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purchaseValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Value</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-purchase-value" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="warrantyExpiry" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty Expiry</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-warranty" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amcExpiry" render={({ field }) => (
                    <FormItem>
                      <FormLabel>AMC Expiry</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-amc" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serialNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl><Input placeholder="SN-XXXXX" {...field} data-testid="input-serial" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="maintenance">Under Maintenance</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="disposed">Disposed</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Input placeholder="Optional notes" {...field} data-testid="input-notes" /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-asset">
                  {createMutation.isPending ? "Saving..." : "Add Asset"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Assets</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-total-assets">{assets?.length || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Value</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-total-value">{fmt(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Warranty &lt; 30d
          </p>
          <p className="text-2xl font-bold mt-1 text-amber-600" data-testid="stat-warranty-exp">{expiringWarranties}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-500" /> AMC &lt; 30d
          </p>
          <p className="text-2xl font-bold mt-1 text-red-600" data-testid="stat-amc-exp">{expiringAmc}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "active", "maintenance", "retired"] as const).map(s => (
          <Button key={s} variant="outline" size="sm" onClick={() => setStatusFilter(s)}
            data-testid={`button-filter-${s}`}
            className={statusFilter === s ? `border ${statusColors[s] || "bg-blue-100 text-blue-700 border-blue-200"} font-semibold` : ""}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No assets registered yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">Add your first fixed asset to start tracking warranties and depreciation.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendor</TableHead>
                  <TableHead className="hidden md:table-cell">Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Warranty</TableHead>
                  <TableHead className="hidden lg:table-cell">AMC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const warrantyDays = a.warrantyExpiry ? differenceInDays(parseISO(a.warrantyExpiry), new Date()) : null;
                  const amcDays = a.amcExpiry ? differenceInDays(parseISO(a.amcExpiry), new Date()) : null;
                  return (
                    <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.assetCode || a.serialNumber || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`capitalize ${categoryColors[a.category] || categoryColors.other}`}>
                          {a.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{a.vendorName || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-medium">{a.purchaseValue ? fmt(Number(a.purchaseValue)) : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {a.warrantyExpiry ? (
                          <span className={warrantyDays! < 0 ? "text-red-600 font-medium" : warrantyDays! < 30 ? "text-amber-600 font-medium" : ""}>
                            {format(parseISO(a.warrantyExpiry), "MMM d, yyyy")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {a.amcExpiry ? (
                          <span className={amcDays! < 0 ? "text-red-600 font-medium" : amcDays! < 30 ? "text-amber-600 font-medium" : ""}>
                            {format(parseISO(a.amcExpiry), "MMM d, yyyy")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${statusColors[a.status] || statusColors.active}`}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${a.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(a.id)} className="text-red-600" data-testid={`action-delete-${a.id}`}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
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
    </div>
  );
}
