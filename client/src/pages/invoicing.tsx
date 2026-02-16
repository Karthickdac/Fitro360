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
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, FileText, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Invoice } from "@shared/schema";

const lineItemSchema = z.object({
  name: z.string().min(1, "Item name required"),
  quantity: z.coerce.number().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Min 0"),
  total: z.number(),
});

const createInvoiceSchema = z.object({
  type: z.string().min(1),
  customerId: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item required"),
  gstRate: z.string().default("5"),
});

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive"; className: string }> = {
  pending: { variant: "default", className: "bg-yellow-600 text-white no-default-hover-elevate no-default-active-elevate" },
  paid: { variant: "default", className: "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" },
  cancelled: { variant: "destructive", className: "" },
};

export default function InvoicingPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      type: "sale",
      customerId: "",
      items: [{ name: "", quantity: 1, unitPrice: 0, total: 0 }],
      gstRate: "5",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const watchedGstRate = form.watch("gstRate");

  const subtotal = watchedItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  const gstRate = parseFloat(watchedGstRate || "5");
  const gstAmount = subtotal * (gstRate / 100);
  const grandTotal = subtotal + gstAmount;

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      const itemsWithTotals = data.items.map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      }));
      const res = await apiRequest("POST", "/api/invoices", {
        ...data,
        items: itemsWithTotals,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice created successfully" });
      form.reset({
        type: "sale",
        customerId: "",
        items: [{ name: "", quantity: 1, unitPrice: 0, total: 0 }],
        gstRate: "5",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update invoice", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-invoicing">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create and manage invoices with VAT calculations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invoice">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-invoice-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sale">Sale</SelectItem>
                            <SelectItem value="purchase">Purchase</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer / Vendor</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer name" {...field} data-testid="input-invoice-customer" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Line Items</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: "", quantity: 1, unitPrice: 0, total: 0 })}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end" data-testid={`row-line-item-${index}`}>
                      <div className="col-span-4">
                        {index === 0 && <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>}
                        <Input
                          {...form.register(`items.${index}.name`)}
                          placeholder="Item"
                          data-testid={`input-item-name-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <FormLabel className="text-xs text-muted-foreground">Qty</FormLabel>}
                        <Input
                          type="number"
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          data-testid={`input-item-qty-${index}`}
                        />
                      </div>
                      <div className="col-span-3">
                        {index === 0 && <FormLabel className="text-xs text-muted-foreground">Unit Price</FormLabel>}
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                          data-testid={`input-item-price-${index}`}
                        />
                      </div>
                      <div className="col-span-2 text-sm text-right text-muted-foreground self-center" data-testid={`text-item-total-${index}`}>
                        AED {((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitPrice || 0)).toFixed(2)}
                      </div>
                      <div className="col-span-1 self-center">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="gstRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-gst-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-md border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span data-testid="text-subtotal">AED {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">VAT ({gstRate}%)</span>
                    <span data-testid="text-gst-amount">AED {gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold border-t pt-1.5">
                    <span>Grand Total</span>
                    <span data-testid="text-grand-total">AED {grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-invoice"
                >
                  {createMutation.isPending ? "Creating..." : "Create Invoice"}
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : (invoices || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No invoices yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Get started by creating your first invoice
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead className="hidden md:table-cell">Subtotal</TableHead>
                  <TableHead className="hidden lg:table-cell">VAT</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoices || []).map((invoice) => {
                  const cfg = statusConfig[invoice.status || "pending"] || statusConfig.pending;
                  const itemsArr = (invoice.items || []) as { name: string; quantity: number; unitPrice: number; total: number }[];
                  return (
                    <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-medium text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">{invoice.type}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {invoice.customerId || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {itemsArr.length}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        AED {parseFloat(invoice.subtotal || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        AED {parseFloat(invoice.gstAmount || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm font-medium" data-testid={`text-invoice-total-${invoice.id}`}>
                        AED {parseFloat(invoice.total || "0").toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={invoice.status || "pending"}
                          onValueChange={(val) => updateStatusMutation.mutate({ id: invoice.id, status: val })}
                        >
                          <SelectTrigger className="border-0 p-0 h-auto w-auto" data-testid={`select-invoice-status-${invoice.id}`}>
                            <Badge variant={cfg.variant} className={cfg.className}>
                              {invoice.status || "pending"}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {invoice.createdAt ? format(new Date(invoice.createdAt), "MMM d, yyyy") : "—"}
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
