import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ScrollText, Trash2, CheckCircle2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SupplierBill, Supplier } from "@shared/schema";

type FormVals = {
  supplierId: string;
  billNumber: string;
  billDate: string;
  description: string;
  category: string;
  subtotal: string;
  vatRate: string;
  vatTreatment: string;
  isDeductible: boolean;
  status: string;
};

export default function SupplierBillsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: bills, isLoading } = useQuery<SupplierBill[]>({ queryKey: ["/api/supplier-bills"] });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const form = useForm<FormVals>({
    defaultValues: {
      supplierId: "",
      billNumber: "",
      billDate: new Date().toISOString().slice(0, 10),
      description: "",
      category: "operating",
      subtotal: "0",
      vatRate: "5",
      vatTreatment: "standard",
      isDeductible: true,
      status: "unpaid",
    },
  });

  const subtotal = parseFloat(form.watch("subtotal") || "0") || 0;
  const vatRate = parseFloat(form.watch("vatRate") || "0") || 0;
  const vatAmount = Math.round(subtotal * vatRate) / 100;
  const total = subtotal + vatAmount;

  const create = useMutation({
    mutationFn: async (data: FormVals) => apiRequest("POST", "/api/supplier-bills", {
      supplierId: data.supplierId || null,
      billNumber: data.billNumber,
      billDate: data.billDate,
      description: data.description || null,
      category: data.category,
      subtotal: String(subtotal),
      vatRate: String(vatRate),
      vatAmount: String(vatAmount),
      total: String(total),
      vatTreatment: data.vatTreatment,
      isDeductible: data.isDeductible,
      status: data.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-bills"] });
      toast({ title: "Bill recorded" });
      form.reset();
      setOpen(false);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/supplier-bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-bills"] });
      toast({ title: "Bill deleted" });
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/supplier-bills/${id}`, { status: "paid", paidAt: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/supplier-bills"] }),
  });

  const supplierName = (id: string | null) => suppliers?.find(s => s.id === id)?.name || "—";

  const totals = (bills || []).reduce(
    (acc, b) => ({
      sub: acc.sub + Number(b.subtotal || 0),
      vat: acc.vat + Number(b.vatAmount || 0),
      total: acc.total + Number(b.total || 0),
      deductibleVat: acc.deductibleVat + (b.isDeductible ? Number(b.vatAmount || 0) : 0),
    }),
    { sub: 0, vat: 0, total: 0, deductibleVat: 0 },
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ScrollText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Supplier Bills</h1>
            <p className="text-sm text-muted-foreground">Purchase invoices used to claim input VAT and reduce taxable profit.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-bill"><Plus className="h-4 w-4 mr-2" />Record Bill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Record Supplier Bill</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={form.watch("supplierId")} onValueChange={(v) => form.setValue("supplierId", v)}>
                    <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {(suppliers || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bill Number *</Label>
                  <Input data-testid="input-bill-number" {...form.register("billNumber", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Bill Date *</Label>
                  <Input type="date" data-testid="input-bill-date" {...form.register("billDate", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operating">Operating</SelectItem>
                      <SelectItem value="equipment">Equipment / Capex</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="professional">Professional Fees</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subtotal (excl. VAT)</Label>
                  <Input type="number" step="0.01" data-testid="input-subtotal" {...form.register("subtotal")} />
                </div>
                <div className="space-y-2">
                  <Label>VAT Rate %</Label>
                  <Input type="number" step="0.01" data-testid="input-vat-rate" {...form.register("vatRate")} />
                </div>
                <div className="space-y-2">
                  <Label>VAT Treatment</Label>
                  <Select value={form.watch("vatTreatment")} onValueChange={(v) => form.setValue("vatTreatment", v)}>
                    <SelectTrigger data-testid="select-treatment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (5%)</SelectItem>
                      <SelectItem value="zero">Zero-rated</SelectItem>
                      <SelectItem value="exempt">Exempt</SelectItem>
                      <SelectItem value="reverse_charge">Reverse Charge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                    <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea data-testid="input-description" {...form.register("description")} rows={2} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Input VAT Deductible</p>
                  <p className="text-xs text-muted-foreground">Include this bill in VAT 201 Box 9 (input VAT recovery)</p>
                </div>
                <Switch checked={form.watch("isDeductible")} onCheckedChange={(v) => form.setValue("isDeductible", v)} data-testid="switch-deductible" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm">
                <span>VAT Amount: <strong>AED {vatAmount.toFixed(2)}</strong></span>
                <span>Total: <strong>AED {total.toFixed(2)}</strong></span>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending} data-testid="button-submit-bill">{create.isPending ? "Saving..." : "Save Bill"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bills", value: (bills || []).length, color: "text-blue-500" },
          { label: "Net Spend", value: `AED ${totals.sub.toFixed(2)}`, color: "text-slate-500" },
          { label: "Total VAT Paid", value: `AED ${totals.vat.toFixed(2)}`, color: "text-amber-500" },
          { label: "Recoverable Input VAT", value: `AED ${totals.deductibleVat.toFixed(2)}`, color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Bills</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bills || []).map((b) => (
                  <TableRow key={b.id} data-testid={`row-bill-${b.id}`}>
                    <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                    <TableCell>{supplierName(b.supplierId)}</TableCell>
                    <TableCell>{b.billDate}</TableCell>
                    <TableCell><Badge variant="outline">{b.category}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{b.vatTreatment}</Badge></TableCell>
                    <TableCell className="text-right">{Number(b.subtotal).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(b.vatAmount).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(b.total).toFixed(2)}</TableCell>
                    <TableCell>
                      {b.status === "paid"
                        ? <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>
                        : <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {b.status !== "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => markPaid.mutate(b.id)} data-testid={`button-pay-${b.id}`}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)} data-testid={`button-delete-${b.id}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (!bills || bills.length === 0) && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No supplier bills yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
