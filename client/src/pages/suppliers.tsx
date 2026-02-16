import { useState } from "react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Truck, Mail, Phone, MapPin, FileText, Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  trnNumber: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      trnNumber: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      const res = await apiRequest("POST", "/api/suppliers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Supplier added successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add supplier", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SupplierFormValues }) => {
      const res = await apiRequest("PATCH", `/api/suppliers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Supplier updated successfully" });
      form.reset();
      setEditingSupplier(null);
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update supplier", description: error.message, variant: "destructive" });
    },
  });

  function openEditDialog(supplier: Supplier) {
    setEditingSupplier(supplier);
    form.reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      trnNumber: supplier.trnNumber || "",
    });
    setDialogOpen(true);
  }

  function openAddDialog() {
    setEditingSupplier(null);
    form.reset({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      trnNumber: "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(data: SupplierFormValues) {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data });
    } else {
      addMutation.mutate(data);
    }
  }

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6" data-testid="page-suppliers">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage your equipment suppliers and vendors</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} data-testid="button-add-supplier">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Fitness Equipment Co." {...field} data-testid="input-supplier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} data-testid="input-supplier-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="supplier@co.com" {...field} data-testid="input-supplier-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+971 50 123 4567" {...field} data-testid="input-supplier-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Industrial Area" {...field} data-testid="input-supplier-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trnNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TRN (Tax Registration Number)</FormLabel>
                      <FormControl>
                        <Input placeholder="100234567890003" {...field} data-testid="input-supplier-trn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                  data-testid="button-submit-supplier"
                >
                  {isPending ? "Saving..." : editingSupplier ? "Update Supplier" : "Add Supplier"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (suppliers || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Truck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No suppliers yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Get started by adding your first supplier
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(suppliers || []).map((supplier) => (
            <Card key={supplier.id} data-testid={`card-supplier-${supplier.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate" data-testid={`text-supplier-name-${supplier.id}`}>
                    {supplier.name}
                  </CardTitle>
                  {supplier.contactPerson && (
                    <p className="text-sm text-muted-foreground mt-0.5">{supplier.contactPerson}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={supplier.isActive ? "default" : "secondary"}
                    data-testid={`badge-supplier-status-${supplier.id}`}
                  >
                    {supplier.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(supplier)}
                    data-testid={`button-edit-supplier-${supplier.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
                {supplier.trnNumber && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>TRN: {supplier.trnNumber}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
