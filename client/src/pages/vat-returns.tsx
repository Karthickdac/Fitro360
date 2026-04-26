import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt, FileCheck2, Calendar, Eye, Send, CheckCircle2, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VatReturn } from "@shared/schema";

type Computed = {
  box1aSalesStandardAmount: number;
  box1aSalesStandardVat: number;
  box2SalesZero: number;
  box3SalesExempt: number;
  box9PurchasesStandardAmount: number;
  box9PurchasesStandardVat: number;
  totalOutputVat: number;
  totalInputVat: number;
  netVatPayable: number;
};

function fmt(n: any) { return Number(n || 0).toFixed(2); }

function statusBadge(status: string) {
  if (status === "filed") return <Badge className="bg-blue-500/15 text-blue-600">Filed</Badge>;
  if (status === "paid") return <Badge className="bg-emerald-500/15 text-emerald-600">Paid</Badge>;
  if (status === "overdue") return <Badge className="bg-red-500/15 text-red-600">Overdue</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function VatReturnsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<VatReturn | null>(null);
  const [filing, setFiling] = useState<VatReturn | null>(null);
  const [ftaRef, setFtaRef] = useState("");

  const { data: returns, isLoading } = useQuery<VatReturn[]>({ queryKey: ["/api/vat/returns"] });

  const today = new Date();
  const defaultEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const defaultStart = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth() - 2, 1);
  const [periodStart, setPeriodStart] = useState(defaultStart.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(defaultEnd.toISOString().slice(0, 10));
  const [preview, setPreview] = useState<Computed | null>(null);

  const compute = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vat/compute", { periodStart, periodEnd });
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => toast({ title: "Compute failed", description: err.message, variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const due = new Date(periodEnd); due.setDate(due.getDate() + 28);
      return apiRequest("POST", "/api/vat/returns", { periodStart, periodEnd, dueDate: due.toISOString().slice(0,10) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vat/returns"] });
      toast({ title: "VAT 201 draft created" });
      setOpen(false);
      setPreview(null);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const fileReturn = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => apiRequest("POST", `/api/vat/returns/${id}/file`, { ftaReference: ref }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vat/returns"] });
      toast({ title: "Return filed" });
      setFiling(null); setFtaRef("");
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/vat/returns/${id}/mark-paid`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vat/returns"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/vat/returns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vat/returns"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">VAT Returns (VAT 201)</h1>
            <p className="text-sm text-muted-foreground">Auto-prepared from invoices and supplier bills. Aligned to UAE FTA boxes.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPreview(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-return"><Plus className="h-4 w-4 mr-2" />New Return</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Prepare New VAT Return</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} data-testid="input-period-start" />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} data-testid="input-period-end" />
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => compute.mutate()} disabled={compute.isPending} data-testid="button-compute">
                {compute.isPending ? "Computing..." : "Compute from invoices & bills"}
              </Button>
              {preview && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex justify-between"><span>Box 1a — Standard sales:</span><span className="font-mono">{fmt(preview.box1aSalesStandardAmount)}</span></div>
                    <div className="flex justify-between"><span>Box 1a — Output VAT (5%):</span><span className="font-mono text-amber-600">{fmt(preview.box1aSalesStandardVat)}</span></div>
                    <div className="flex justify-between"><span>Box 2 — Zero-rated sales:</span><span className="font-mono">{fmt(preview.box2SalesZero)}</span></div>
                    <div className="flex justify-between"><span>Box 3 — Exempt sales:</span><span className="font-mono">{fmt(preview.box3SalesExempt)}</span></div>
                    <div className="flex justify-between"><span>Box 9 — Standard purchases:</span><span className="font-mono">{fmt(preview.box9PurchasesStandardAmount)}</span></div>
                    <div className="flex justify-between"><span>Box 9 — Input VAT:</span><span className="font-mono text-emerald-600">{fmt(preview.box9PurchasesStandardVat)}</span></div>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                    <span>Net VAT Payable to FTA:</span>
                    <span className={preview.netVatPayable >= 0 ? "text-red-600" : "text-emerald-600"}>
                      AED {fmt(preview.netVatPayable)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !preview} data-testid="button-save-return">
                {create.isPending ? "Saving..." : "Save Draft Return"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Filed & Draft Returns</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Output VAT</TableHead>
                  <TableHead className="text-right">Input VAT</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>FTA Ref</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(returns || []).map((r) => (
                  <TableRow key={r.id} data-testid={`row-return-${r.id}`}>
                    <TableCell className="font-medium">{r.periodStart} → {r.periodEnd}</TableCell>
                    <TableCell><span className="inline-flex items-center gap-1 text-xs"><Calendar className="h-3 w-3" />{r.dueDate || "—"}</span></TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.totalOutputVat)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.totalInputVat)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(r.netVatPayable)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs font-mono">{r.ftaReference || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(r)} data-testid={`button-view-${r.id}`}><Eye className="h-4 w-4" /></Button>
                        {r.status === "draft" && (
                          <Button size="sm" variant="ghost" onClick={() => setFiling(r)} data-testid={`button-file-${r.id}`}><Send className="h-4 w-4 text-blue-500" /></Button>
                        )}
                        {r.status === "filed" && (
                          <Button size="sm" variant="ghost" onClick={() => markPaid.mutate(r.id)} data-testid={`button-paid-${r.id}`}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} data-testid={`button-delete-${r.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (!returns || returns.length === 0) && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No VAT returns yet. Click "New Return" to prepare your first VAT 201.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>VAT 201 — {viewing?.periodStart} → {viewing?.periodEnd}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Sales & Outputs</CardTitle>
                  <CardDescription>Output VAT collected on behalf of FTA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Box 1a — Standard rated sales (5%) — Amount</span><span className="font-mono">{fmt(viewing.box1aSalesStandardAmount)}</span></div>
                  <div className="flex justify-between"><span>Box 1a — Standard rated sales (5%) — VAT</span><span className="font-mono text-amber-600">{fmt(viewing.box1aSalesStandardVat)}</span></div>
                  <div className="flex justify-between"><span>Box 2 — Zero-rated supplies</span><span className="font-mono">{fmt(viewing.box2SalesZero)}</span></div>
                  <div className="flex justify-between"><span>Box 3 — Exempt supplies</span><span className="font-mono">{fmt(viewing.box3SalesExempt)}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-2 font-semibold"><span>Total Output VAT</span><span className="font-mono">{fmt(viewing.totalOutputVat)}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Purchases & Inputs</CardTitle>
                  <CardDescription>Recoverable input VAT</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Box 9 — Standard rated expenses — Amount</span><span className="font-mono">{fmt(viewing.box9PurchasesStandardAmount)}</span></div>
                  <div className="flex justify-between"><span>Box 9 — Recoverable input VAT</span><span className="font-mono text-emerald-600">{fmt(viewing.box9PurchasesStandardVat)}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-2 font-semibold"><span>Total Input VAT</span><span className="font-mono">{fmt(viewing.totalInputVat)}</span></div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold">Net VAT Payable to FTA</span>
                  </div>
                  <span className="text-xl font-bold font-mono">AED {fmt(viewing.netVatPayable)}</span>
                </CardContent>
              </Card>
              <div className="text-xs text-muted-foreground">
                Status: <strong>{viewing.status}</strong> · FTA Reference: {viewing.ftaReference || "—"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!filing} onOpenChange={(v) => { if (!v) { setFiling(null); setFtaRef(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>File VAT Return with FTA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">After submitting on the FTA portal, paste the acknowledgment reference below to mark this return as filed.</p>
            <div className="space-y-2">
              <Label>FTA Reference Number</Label>
              <Input value={ftaRef} onChange={(e) => setFtaRef(e.target.value)} placeholder="e.g. VAT201-XXXXXX" data-testid="input-fta-ref" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => filing && fileReturn.mutate({ id: filing.id, ref: ftaRef })} disabled={fileReturn.isPending} data-testid="button-confirm-file">
              {fileReturn.isPending ? "Filing..." : "Mark as Filed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
