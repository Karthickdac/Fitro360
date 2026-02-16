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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, Building2, Pencil, Trash2, Globe, Users, UserCheck,
  ChevronLeft, ExternalLink,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tenant, User } from "@shared/schema";

const tenantFormSchema = z.object({
  gymName: z.string().min(1, "Gym name is required"),
  email: z.string().email("Valid email required"),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  subscriptionPlan: z.string().min(1),
  primaryColor: z.string().default("#1e40af"),
  secondaryColor: z.string().default("#3b82f6"),
  market: z.string().default("uae"),
});

const addTenantSchema = tenantFormSchema.extend({
  ownerFirstName: z.string().min(1, "Owner first name required"),
  ownerLastName: z.string().min(1, "Owner last name required"),
  ownerUsername: z.string().min(3, "Username must be at least 3 characters"),
  ownerPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type TenantDetail = Tenant & { userCount: number; memberCount: number; users: User[] };

export default function TenantsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: tenantDetail } = useQuery<TenantDetail>({
    queryKey: ["/api/admin/tenants", detailTenantId],
    enabled: !!detailTenantId,
  });

  const addForm = useForm({
    resolver: zodResolver(addTenantSchema),
    defaultValues: {
      gymName: "", email: "", domain: "", subdomain: "",
      subscriptionPlan: "basic", primaryColor: "#1e40af",
      secondaryColor: "#3b82f6", market: "uae",
      ownerFirstName: "", ownerLastName: "",
      ownerUsername: "", ownerPassword: "",
    },
  });

  const editForm = useForm({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      gymName: "", email: "", domain: "", subdomain: "",
      subscriptionPlan: "basic", primaryColor: "#1e40af",
      secondaryColor: "#3b82f6", market: "uae",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTenantSchema>) => {
      const res = await apiRequest("POST", "/api/admin/tenants", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Tenant created successfully" });
      addForm.reset();
      setAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create tenant", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tenantFormSchema> & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/admin/tenants/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant updated successfully" });
      setEditDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update tenant", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/tenants/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Tenant deleted" });
      setDeleteDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete tenant", description: error.message, variant: "destructive" });
    },
  });

  function openEditDialog(tenant: Tenant) {
    setSelectedTenant(tenant);
    editForm.reset({
      gymName: tenant.gymName,
      email: tenant.email || "",
      domain: tenant.domain || "",
      subdomain: (tenant as any).subdomain || "",
      subscriptionPlan: tenant.subscriptionPlan || "basic",
      primaryColor: tenant.primaryColor || "#1e40af",
      secondaryColor: tenant.secondaryColor || "#3b82f6",
      market: (tenant as any).market || "uae",
    });
    setEditDialogOpen(true);
  }

  const filtered = (tenants || []).filter((t) =>
    `${t.gymName} ${t.domain || ""} ${(t as any).subdomain || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  if (detailTenantId) {
    return (
      <div className="p-6 space-y-6" data-testid="page-tenant-detail">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setDetailTenantId(null)} data-testid="button-back-tenants">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Tenants
          </Button>
        </div>

        {tenantDetail ? (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-lg text-white font-bold text-lg"
                  style={{ backgroundColor: tenantDetail.primaryColor || "#1e40af" }}
                >
                  {tenantDetail.gymName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{tenantDetail.gymName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={tenantDetail.isActive ? "default" : "destructive"}>
                      {tenantDetail.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">{tenantDetail.subscriptionPlan}</Badge>
                    {(tenantDetail as any).subdomain && (
                      <Badge variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" />
                        {(tenantDetail as any).subdomain}.fitro360.com
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(tenantDetail)} data-testid="button-edit-tenant-detail">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-user-count">{tenantDetail.userCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Members</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-member-count">{tenantDetail.memberCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Market</p>
                  <p className="text-2xl font-bold mt-1 uppercase">{(tenantDetail as any).market || "uae"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-lg font-semibold mt-1">
                    {tenantDetail.createdAt ? format(new Date(tenantDetail.createdAt), "MMM d, yyyy") : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Tenant Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Email:</span> <span className="ml-2 font-medium">{tenantDetail.email || "-"}</span></div>
                  <div><span className="text-muted-foreground">Domain:</span> <span className="ml-2 font-medium">{tenantDetail.domain || "-"}</span></div>
                  <div><span className="text-muted-foreground">Subdomain:</span> <span className="ml-2 font-medium">{(tenantDetail as any).subdomain ? `${(tenantDetail as any).subdomain}.fitro360.com` : "-"}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="ml-2 font-medium">{tenantDetail.phone || "-"}</span></div>
                  <div><span className="text-muted-foreground">Primary Color:</span> <span className="ml-2 font-medium flex items-center gap-2">{tenantDetail.primaryColor} <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: tenantDetail.primaryColor || "#1e40af" }} /></span></div>
                  <div><span className="text-muted-foreground">Secondary Color:</span> <span className="ml-2 font-medium flex items-center gap-2">{tenantDetail.secondaryColor} <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: tenantDetail.secondaryColor || "#3b82f6" }} /></span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Users ({tenantDetail.users?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tenantDetail.users || []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{u.username}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{u.role.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-14 w-64" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-tenants">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1">Manage gym tenants on your platform</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-tenant">
              <Plus className="h-4 w-4 mr-2" />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Tenant</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
                <FormField control={addForm.control} name="gymName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gym Name</FormLabel>
                    <FormControl><Input placeholder="FitZone Pro" {...field} data-testid="input-tenant-gym-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="admin@gym.com" {...field} data-testid="input-tenant-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="subdomain" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdomain</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-0">
                          <Input placeholder="fitzone" {...field} className="rounded-r-none" data-testid="input-tenant-subdomain" />
                          <span className="inline-flex items-center px-2 h-9 bg-muted border border-l-0 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">.fitro360.com</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={addForm.control} name="domain" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Domain (optional)</FormLabel>
                    <FormControl><Input placeholder="app.fitzone.com" {...field} data-testid="input-tenant-domain" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="subscriptionPlan" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Plan</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tenant-plan"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="market" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Market</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tenant-market"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="uae">UAE (AED, VAT)</SelectItem>
                          <SelectItem value="india">India (INR, GST)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="primaryColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input type="color" value={field.value} onChange={field.onChange} className="h-9 w-10 rounded-md border cursor-pointer" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="secondaryColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input type="color" value={field.value} onChange={field.onChange} className="h-9 w-10 rounded-md border cursor-pointer" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator className="my-2" />
                <p className="text-sm font-medium">Gym Owner Account</p>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="ownerFirstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-owner-first-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="ownerLastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-owner-last-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="ownerUsername" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} data-testid="input-owner-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="ownerPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} data-testid="input-owner-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-tenant">
                  {addMutation.isPending ? "Creating..." : "Create Tenant"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-tenants"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No tenants found</h3>
              <p className="text-muted-foreground mt-1">
                {search ? "Try adjusting your search" : "Add your first gym tenant to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym</TableHead>
                  <TableHead className="hidden md:table-cell">Subdomain</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="hidden sm:table-cell">Market</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tenant) => (
                  <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                    <TableCell>
                      <button
                        className="flex items-center gap-3 hover:underline text-left"
                        onClick={() => setDetailTenantId(tenant.id)}
                        data-testid={`link-tenant-${tenant.id}`}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white font-semibold text-sm"
                          style={{ backgroundColor: tenant.primaryColor || "#1e40af" }}
                        >
                          {tenant.gymName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-sm block truncate">{tenant.gymName}</span>
                          <span className="text-xs text-muted-foreground truncate block">{tenant.email || ""}</span>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {(tenant as any).subdomain ? (
                        <span className="text-muted-foreground">{(tenant as any).subdomain}.fitro360.com</span>
                      ) : tenant.domain ? (
                        <span className="text-muted-foreground">{tenant.domain}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{tenant.subscriptionPlan}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="uppercase text-xs">{(tenant as any).market || "uae"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={tenant.isActive ?? true}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: tenant.id, isActive: checked })}
                        data-testid={`switch-tenant-active-${tenant.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(tenant)}
                          data-testid={`button-edit-tenant-${tenant.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => { setSelectedTenant(tenant); setDeleteDialogOpen(true); }}
                          data-testid={`button-delete-tenant-${tenant.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate({ ...d, id: selectedTenant?.id || "" }))} className="space-y-4">
              <FormField control={editForm.control} name="gymName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gym Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-gym-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} data-testid="input-edit-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="subdomain" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subdomain</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-0">
                        <Input {...field} className="rounded-r-none" data-testid="input-edit-subdomain" />
                        <span className="inline-flex items-center px-2 h-9 bg-muted border border-l-0 rounded-r-md text-xs text-muted-foreground whitespace-nowrap">.fitro360.com</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="domain" render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Domain (optional)</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-domain" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="subscriptionPlan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="market" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="uae">UAE (AED, VAT)</SelectItem>
                        <SelectItem value="india">India (INR, GST)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="primaryColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input type="color" value={field.value} onChange={field.onChange} className="h-9 w-10 rounded-md border cursor-pointer" />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="secondaryColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input type="color" value={field.value} onChange={field.onChange} className="h-9 w-10 rounded-md border cursor-pointer" />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-tenant">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selectedTenant?.gymName}</strong> and all associated users, members, and data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTenant && deleteMutation.mutate(selectedTenant.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-tenant"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Tenant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
