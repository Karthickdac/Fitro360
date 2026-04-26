import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Save, Calculator, Receipt } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TaxProfile = {
  market: string | null;
  legalName: string | null;
  tradeLicenseNumber: string | null;
  trn: string | null;
  vatRegisteredOn: string | null;
  vatFilingFrequency: string | null;
  ctTrn: string | null;
  ctRegisteredOn: string | null;
  fyStartMonth: number | null;
};

export default function TaxSettingsPage() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useQuery<TaxProfile>({ queryKey: ["/api/tax/profile"] });

  const form = useForm<TaxProfile>({
    defaultValues: {
      market: "uae",
      legalName: "",
      tradeLicenseNumber: "",
      trn: "",
      vatRegisteredOn: "",
      vatFilingFrequency: "quarterly",
      ctTrn: "",
      ctRegisteredOn: "",
      fyStartMonth: 1,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        market: profile.market || "uae",
        legalName: profile.legalName || "",
        tradeLicenseNumber: profile.tradeLicenseNumber || "",
        trn: profile.trn || "",
        vatRegisteredOn: profile.vatRegisteredOn || "",
        vatFilingFrequency: profile.vatFilingFrequency || "quarterly",
        ctTrn: profile.ctTrn || "",
        ctRegisteredOn: profile.ctRegisteredOn || "",
        fyStartMonth: profile.fyStartMonth || 1,
      });
    }
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: async (data: TaxProfile) => {
      const payload: any = { ...data };
      if (!payload.vatRegisteredOn) payload.vatRegisteredOn = null;
      if (!payload.ctRegisteredOn) payload.ctRegisteredOn = null;
      payload.fyStartMonth = Number(payload.fyStartMonth) || 1;
      return apiRequest("PATCH", "/api/tax/profile", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/profile"] });
      toast({ title: "Tax profile updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Landmark className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Tax Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your UAE FTA tax registration and filing schedule.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legal Entity</CardTitle>
            <CardDescription>Information used on returns and invoices.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input data-testid="input-legal-name" {...form.register("legalName")} placeholder="Fitness Co. LLC" />
            </div>
            <div className="space-y-2">
              <Label>Trade License Number</Label>
              <Input data-testid="input-trade-license" {...form.register("tradeLicenseNumber")} placeholder="123456" />
            </div>
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={form.watch("market") || "uae"} onValueChange={(v) => form.setValue("market", v)}>
                <SelectTrigger data-testid="select-market"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uae">UAE (VAT 5% + CT 9%)</SelectItem>
                  <SelectItem value="india">India (GST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">VAT (Value Added Tax)</CardTitle>
            </div>
            <CardDescription>FTA VAT registration number and filing cadence for VAT 201 returns.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>TRN (15-digit)</Label>
              <Input data-testid="input-trn" {...form.register("trn")} placeholder="100123456700003" />
            </div>
            <div className="space-y-2">
              <Label>VAT Registered On</Label>
              <Input type="date" data-testid="input-vat-registered" {...form.register("vatRegisteredOn")} />
            </div>
            <div className="space-y-2">
              <Label>Filing Frequency</Label>
              <Select value={form.watch("vatFilingFrequency") || "quarterly"} onValueChange={(v) => form.setValue("vatFilingFrequency", v)}>
                <SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Corporate Tax</CardTitle>
            </div>
            <CardDescription>UAE CT applies at 9% above AED 375,000 taxable income (since 1 Jun 2023).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Corporate Tax TRN</Label>
              <Input data-testid="input-ct-trn" {...form.register("ctTrn")} placeholder="200xxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>CT Registered On</Label>
              <Input type="date" data-testid="input-ct-registered" {...form.register("ctRegisteredOn")} />
            </div>
            <div className="space-y-2">
              <Label>Financial Year Start (Month)</Label>
              <Select value={String(form.watch("fyStartMonth") || 1)} onValueChange={(v) => form.setValue("fyStartMonth", Number(v))}>
                <SelectTrigger data-testid="select-fy-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                    <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save">
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Saving..." : "Save Tax Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
