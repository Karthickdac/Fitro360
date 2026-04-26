import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calculator, Calendar, Eye, Send, CheckCircle2, Trash2, TrendingUp, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CorporateTaxReturn } from "@shared/schema";

type Computed = {
  totalRevenue: number;
  totalExpenses: number;
  accountingProfit: number;
  taxableIncome: number;
  taxDue: number;
};

function fmt(n: any) { return Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function statusBadge(status: string) {
  if (status === "filed") return <Badge className="bg-blue-500/15 text-blue-600">Filed</Badge>;
  if (status === "paid") return <Badge className="bg-emerald-500/15 text-emerald-600">Paid</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function CorporateTaxPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<CorporateTaxReturn | null>(null);
  const [filing, setFiling] = useState<CorporateTaxReturn | null>(null);
  const [ftaRef, setFtaRef] = useState("");

  const { data: returns, isLoading } = useQuery<CorporateTaxReturn[]>({ queryKey: ["/api/ct/returns"] });

  const today = new Date();
  const fyStartDefault = `${today.getFullYear() - 1}-01-01`;
  const fyEndDefault = `${today.getFullYear() - 1}-12-31`;
  const [fyStart, setFyStart] = useState(fyStartDefault);
  const [fyEnd, setFyEnd] = useState(fyEndDefault);
  const [addBacks, setAddBacks] = useState("0");
  const [exemptIncome, setExemptIncome] = useState("0");
  const [reliefClaimed, setReliefClaimed] = useState("0");
  const [smallBusinessRelief, setSmallBusinessRelief] = useState(false);
  const [preview, setPreview] = useState<Computed | null>(null);

  const compute = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ct/compute", { fyStart, fyEnd });
      return res.json();
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => toast({ title: "Compute failed", description: err.message, variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const due = new Date(fyEnd); due.setMonth(due.getMonth() + 9);
      return apiRequest("POST", "/api/ct/returns", {
        fyStart, fyEnd,
        dueDate: due.toISOString().slice(0, 10),
        addBacks: Number(addBacks) || 0,
        exemptIncome: Number(exemptIncome) || 0,
        reliefClaimed: Number(reliefClaimed) || 0,
        smallBusinessRelief,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ct/returns"] });
      toast({ title: "CT return draft created" });
      setOpen(false);
      setPreview(null);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const fileReturn = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => apiRequest("POST", `/api/ct/returns/${id}/file`, { ftaReference: ref }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ct/returns"] });
      toast({ title: "CT return filed" });
      setFiling(null); setFtaRef("");
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/ct/returns/${id}/mark-paid`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ct/returns"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ct/returns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ct/returns"] }),
  });

  const computedAccountingProfit = preview ? preview.accountingProfit + Number(addBacks || 0) - Number(exemptIncome || 0) : 0;
  const computedTaxableIncome = Math.max(0, computedAccountingProfit - Number(reliefClaimed || 0));
  const threshold = 375000;
  let computedTaxDue = computedTaxableIncome > threshold ? (computedTaxableIncome - threshold) * 0.09 : 0;
  if (smallBusinessRelief && preview && preview.totalRevenue <= 3_000_000) computedTaxDue = 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Corporate Tax</h1>
            <p className="text-sm text-muted-foreground">UAE CT at 9% on taxable income above AED 375,000. Small business relief available up to AED 3M revenue.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPreview(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-ct"><Plus className="h-4 w-4 mr-2" />New CT Return</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Prepare Corporate Tax Return</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Financial Year Start</Label>
                  <Input type="date" value={fyStart} onChange={(e) => setFyStart(e.target.value)} data-testid="input-fy-start" />
                </div>
                <div className="space-y-2">
                  <Label>Financial Year End</Label>
                  <Input type="date" value={fyEnd} onChange={(e) => setFyEnd(e.target.value)} data-testid="input-fy-end" />
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => compute.mutate()} disabled={compute.isPending} data-testid="button-compute-ct">
                {compute.isPending ? "Computing..." : "Compute revenue & expenses from books"}
              </Button>
              {preview && (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Total Revenue (from invoices):</span><span className="font-mono">AED {fmt(preview.totalRevenue)}</span></div>
                    <div className="flex justify-between"><span>Total Expenses (from supplier bills):</span><span className="font-mono">AED {fmt(preview.totalExpenses)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-2"><span>Book Profit:</span><span className="font-mono">AED {fmt(preview.accountingProfit)}</span></div>
                  </div>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Tax Adjustments</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Add-backs (non-deductible)</Label>
                          <Input type="number" step="0.01" value={addBacks} onChange={(e) => setAddBacks(e.target.value)} data-testid="input-addbacks" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Exempt Income</Label>
                          <Input type="number" step="0.01" value={exemptIncome} onChange={(e) => setExemptIncome(e.target.value)} data-testid="input-exempt" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Reliefs Claimed</Label>
                          <Input type="number" step="0.01" value={reliefClaimed} onChange={(e) => setReliefClaimed(e.target.value)} data-testid="input-relief" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Small Business Relief</p>
                          <p className="text-xs text-muted-foreground">Available if revenue ≤ AED 3,000,000 (FY 2023–2026)</p>
                        </div>
                        <Switch checked={smallBusinessRelief} onCheckedChange={setSmallBusinessRelief} data-testid="switch-sbr" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/30">
                    <CardContent className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span>Adjusted Accounting Profit:</span><span className="font-mono">AED {fmt(computedAccountingProfit)}</span></div>
                      <div className="flex justify-between"><span>Taxable Income (after relief):</span><span className="font-mono">AED {fmt(computedTaxableIncome)}</span></div>
                      <div className="flex justify-between"><span>0% Threshold:</span><span className="font-mono">AED {fmt(threshold)}</span></div>
                      <div className="flex justify-between border-t pt-2 mt-2 font-semibold text-base">
                        <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-500" />Corporate Tax Due (9%):</span>
                        <span className="font-mono text-emerald-600">AED {fmt(computedTaxDue)}</span>
                      </div>
                      {smallBusinessRelief && preview.totalRevenue > 3_000_000 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
                          <AlertCircle className="h-4 w-4" />
                          Small Business Relief unavailable — revenue exceeds AED 3M cap.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !preview} data-testid="button-save-ct">
                {create.isPending ? "Saving..." : "Save Draft Return"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>CT Return History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Financial Year</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">Tax Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(returns || []).map((r) => (
                  <TableRow key={r.id} data-testid={`row-ct-${r.id}`}>
                    <TableCell className="font-medium">{r.fyStart} → {r.fyEnd}</TableCell>
                    <TableCell><span className="inline-flex items-center gap-1 text-xs"><Calendar className="h-3 w-3" />{r.dueDate || "—"}</span></TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.totalRevenue)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.accountingProfit)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.taxableIncome)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-600">{fmt(r.taxDue)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(r)} data-testid={`button-view-ct-${r.id}`}><Eye className="h-4 w-4" /></Button>
                        {r.status === "draft" && (
                          <Button size="sm" variant="ghost" onClick={() => setFiling(r)} data-testid={`button-file-ct-${r.id}`}><Send className="h-4 w-4 text-blue-500" /></Button>
                        )}
                        {r.status === "filed" && (
                          <Button size="sm" variant="ghost" onClick={() => markPaid.mutate(r.id)} data-testid={`button-paid-ct-${r.id}`}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} data-testid={`button-delete-ct-${r.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (!returns || returns.length === 0) && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No CT returns yet. Click "New CT Return" to prepare your first filing.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>CT Return — FY {viewing?.fyStart} to {viewing?.fyEnd}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Summary</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex justify-between"><span>Total Revenue</span><span className="font-mono">AED {fmt(viewing.totalRevenue)}</span></div>
                  <div className="flex justify-between"><span>Total Expenses</span><span className="font-mono">AED {fmt(viewing.totalExpenses)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1.5"><span>Accounting Profit</span><span className="font-mono">AED {fmt(viewing.accountingProfit)}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Adjustments</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex justify-between"><span>Add-backs</span><span className="font-mono">AED {fmt(viewing.addBacks)}</span></div>
                  <div className="flex justify-between"><span>Exempt Income</span><span className="font-mono">AED {fmt(viewing.exemptIncome)}</span></div>
                  <div className="flex justify-between"><span>Reliefs Claimed</span><span className="font-mono">AED {fmt(viewing.reliefClaimed)}</span></div>
                  <div className="flex justify-between"><span>Small Business Relief</span><span>{viewing.smallBusinessRelief ? "Yes" : "No"}</span></div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/30">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex justify-between"><span>Taxable Income</span><span className="font-mono">AED {fmt(viewing.taxableIncome)}</span></div>
                  <div className="flex justify-between"><span>0% Threshold</span><span className="font-mono">AED {fmt(viewing.threshold)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t pt-2 mt-1"><span>Tax Due (9%)</span><span className="font-mono text-emerald-600">AED {fmt(viewing.taxDue)}</span></div>
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
          <DialogHeader><DialogTitle>File Corporate Tax Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">After submitting on EmaraTax, paste the acknowledgment reference below.</p>
            <div className="space-y-2">
              <Label>FTA Reference Number</Label>
              <Input value={ftaRef} onChange={(e) => setFtaRef(e.target.value)} placeholder="e.g. CT-XXXXXX" data-testid="input-ct-fta-ref" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => filing && fileReturn.mutate({ id: filing.id, ref: ftaRef })} disabled={fileReturn.isPending} data-testid="button-confirm-file-ct">
              {fileReturn.isPending ? "Filing..." : "Mark as Filed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
