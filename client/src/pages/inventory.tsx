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
import { Plus, Search, Package, AlertTriangle, Trash2, Boxes, TrendingDown, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMarket } from "@/hooks/use-market";
import type { Equipment } from "@shared/schema";

const categories = ["Cardio", "Strength", "Accessories", "Supplements", "Apparel"] as const;

const addEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  sku: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or more"),
  minStock: z.coerce.number().min(0, "Min stock must be 0 or more"),
  costPrice: z.string().optional(),
  sellPrice: z.string().optional(),
});

type AddEquipmentValues = z.infer<typeof addEquipmentSchema>;

function getStockStatus(quantity: number | null, minStock: number | null): "in_stock" | "low_stock" | "out_of_stock" {
  const qty = quantity ?? 0;
  const min = minStock ?? 0;
  if (qty === 0) return "out_of_stock";
  if (qty <= min) return "low_stock";
  return "in_stock";
}

function getMargin(costPrice: string | null, sellPrice: string | null): string {
  const cost = parseFloat(costPrice || "0");
  const sell = parseFloat(sellPrice || "0");
  if (cost <= 0 || sell <= 0) return "—";
  const margin = ((sell - cost) / sell) * 100;
  return `${margin.toFixed(1)}%`;
}

const statusConfig = {
  in_stock: { label: "In Stock", variant: "default" as const, className: "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" },
  low_stock: { label: "Low Stock", variant: "default" as const, className: "bg-yellow-600 text-white no-default-hover-elevate no-default-active-elevate" },
  out_of_stock: { label: "Out of Stock", variant: "destructive" as const, className: "" },
};

export default function InventoryPage() {
  const { fmt } = useMarket();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: equipment, isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const form = useForm<AddEquipmentValues>({
    resolver: zodResolver(addEquipmentSchema),
    defaultValues: {
      name: "",
      category: "",
      sku: "",
      quantity: 0,
      minStock: 5,
      costPrice: "",
      sellPrice: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: AddEquipmentValues) => {
      const res = await apiRequest("POST", "/api/equipment", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Equipment added successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add equipment", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Equipment deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const items = equipment || [];
  const lowStockItems = items.filter((item) => {
    const status = getStockStatus(item.quantity, item.minStock);
    return status === "low_stock" || status === "out_of_stock";
  });

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-inventory">
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4" data-testid="alert-low-stock">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-medium">Low Stock Alert</p>
            <p className="text-xs text-muted-foreground">
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} below minimum stock level:{" "}
              {lowStockItems.map((i) => i.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage your equipment stock and pricing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Equipment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Treadmill Pro X" {...field} data-testid="input-equipment-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-equipment-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="SKU-001" {...field} data-testid="input-equipment-sku" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-equipment-quantity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Stock</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-equipment-min-stock" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-equipment-cost-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sell Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-equipment-sell-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addMutation.isPending}
                  data-testid="button-submit-equipment"
                >
                  {addMutation.isPending ? "Adding..." : "Add Equipment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={items.length} icon={Boxes} color="blue" />
        <StatCard title="Low Stock" value={lowStockItems.length} icon={TrendingDown} color="amber" />
        <StatCard title="Categories" value={new Set(items.map(i => i.category)).size} icon={BarChart3} color="violet" />
        <StatCard title="Total Value" value={fmt(items.reduce((s, i) => s + (parseFloat(i.sellPrice || "0") * (i.quantity ?? 0)), 0))} icon={Package} color="emerald" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-equipment"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No equipment found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                {search || categoryFilter !== "all" ? "Try adjusting your search or filters" : "Get started by adding your first equipment item"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="hidden lg:table-cell">Min Stock</TableHead>
                  <TableHead className="hidden md:table-cell">Cost Price</TableHead>
                  <TableHead className="hidden md:table-cell">Sell Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Margin</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const status = getStockStatus(item.quantity, item.minStock);
                  const cfg = statusConfig[status];
                  return (
                    <TableRow key={item.id} data-testid={`row-equipment-${item.id}`}>
                      <TableCell className="font-medium text-sm">{item.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={`text-xs ${
                          item.category === "Cardio" ? "bg-blue-100 text-blue-700 border-blue-200" :
                          item.category === "Strength" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          item.category === "Accessories" ? "bg-violet-100 text-violet-700 border-violet-200" :
                          item.category === "Supplements" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          "bg-cyan-100 text-cyan-700 border-cyan-200"
                        }`}>{item.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.sku || "—"}</TableCell>
                      <TableCell className="text-sm" data-testid={`text-qty-${item.id}`}>{item.quantity ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{item.minStock ?? 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {item.costPrice ? fmt(item.costPrice) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {item.sellPrice ? fmt(item.sellPrice) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className={cfg.className} data-testid={`badge-status-${item.id}`}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground" data-testid={`text-margin-${item.id}`}>
                        {getMargin(item.costPrice, item.sellPrice)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-equipment-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
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
