import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, AlertCircle, Cpu, DoorOpen, Trash2, Copy, Plus } from "lucide-react";

type Device = {
  id: string;
  name: string;
  brand: string;
  model?: string;
  serialNumber: string;
  ipAddress?: string;
  port?: number;
  branchId?: string;
  mode: string;
  status: string;
  isActive: boolean;
  doorOpenSeconds?: number;
  lastSeenAt?: string | null;
  lastError?: string | null;
};

type Branch = { id: string; name: string };

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  brand: z.string().min(1, "Brand required"),
  model: z.string().optional(),
  serialNumber: z.string().min(1, "Serial number required"),
  ipAddress: z.string().optional(),
  port: z.coerce.number().int().positive().optional(),
  branchId: z.string().optional(),
  mode: z.enum(["cloud_push", "local_relay"]).default("cloud_push"),
  doorOpenSeconds: z.coerce.number().int().min(1).max(60).default(5),
  username: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function DevicesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<{ secret: string; name: string } | null>(null);

  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: brandsMeta } = useQuery<{ supported: string[]; planned: string[] }>({
    queryKey: ["/api/biometric/brands"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", brand: "zkteco", model: "", serialNumber: "",
      ipAddress: "", branchId: "", mode: "cloud_push", doorOpenSeconds: 5, username: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/devices", {
        ...values,
        port: values.port || undefined,
        branchId: values.branchId || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setOpen(false);
      form.reset();
      setShowSecret({ secret: data.secret, name: data.name });
      toast({ title: "Device added", description: `${data.name} created. Save the device secret now.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add device", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "Device removed" });
    },
  });

  const openDoorMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/devices/${id}/open-door`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-events"] });
      toast({ title: "Door open command queued" });
    },
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-devices-heading">Biometric Devices</h1>
          <p className="text-sm text-muted-foreground">Connect face / fingerprint / RFID readers to control gym entry</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-device"><Plus className="mr-2 h-4 w-4" /> Add Device</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a biometric device</DialogTitle>
              <DialogDescription>
                Pick the brand, give it a name and the serial number printed on the device. We'll
                generate a shared secret for you to paste into the device's webhook settings.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-3">
                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl><Input data-testid="input-device-name" placeholder="Front Door Reader" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField name="brand" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-device-brand"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(brandsMeta?.supported ?? ["zkteco", "essl", "hikvision", "realtime"]).map((b) => (
                            <SelectItem key={b} value={b} data-testid={`option-brand-${b}`}>{b.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="model" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl><Input data-testid="input-device-model" placeholder="K40 / DS-K1T341" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField name="serialNumber" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial number</FormLabel>
                    <FormControl><Input data-testid="input-device-serial" placeholder="From sticker on device" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField name="ipAddress" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>LAN IP (optional)</FormLabel>
                      <FormControl><Input data-testid="input-device-ip" placeholder="192.168.1.50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="port" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl><Input data-testid="input-device-port" type="number" placeholder="80" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField name="mode" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-device-mode"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="cloud_push">Cloud push (device → us)</SelectItem>
                          <SelectItem value="local_relay">Local relay agent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="doorOpenSeconds" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Door open (sec)</FormLabel>
                      <FormControl><Input data-testid="input-door-seconds" type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField name="branchId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-device-branch"><SelectValue placeholder="All branches" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-device">
                    {createMutation.isPending ? "Creating..." : "Create device"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {brandsMeta?.planned?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Planned brands</CardTitle>
            <CardDescription>
              Coming soon: {brandsMeta.planned.map((b) => b.toUpperCase()).join(", ")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading devices...</div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cpu className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p>No devices yet. Click "Add Device" to connect your first reader.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((d) => (
            <Card key={d.id} data-testid={`card-device-${d.id}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <CardDescription>{d.brand.toUpperCase()} • {d.model || "—"} • SN {d.serialNumber}</CardDescription>
                </div>
                <Badge variant={d.status === "online" ? "default" : "secondary"} data-testid={`status-device-${d.id}`}>
                  {d.status === "online" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                  {d.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  <div>Mode: <span className="text-foreground">{d.mode === "cloud_push" ? "Cloud push" : "Local relay"}</span></div>
                  <div>Door: <span className="text-foreground">{d.doorOpenSeconds}s</span></div>
                  {d.ipAddress && <div>IP: <span className="text-foreground">{d.ipAddress}</span></div>}
                  {d.lastSeenAt && <div>Last seen: <span className="text-foreground">{new Date(d.lastSeenAt).toLocaleString()}</span></div>}
                </div>
                {d.lastError && <div className="text-xs text-destructive">Error: {d.lastError}</div>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDoorMutation.mutate(d.id)} data-testid={`button-open-door-${d.id}`}>
                    <DoorOpen className="h-4 w-4 mr-1" /> Open door
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                    if (confirm(`Delete device "${d.name}"? Past access events will be retained.`)) deleteMutation.mutate(d.id);
                  }} data-testid={`button-delete-device-${d.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!showSecret} onOpenChange={(v) => !v && setShowSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device secret for {showSecret?.name}</DialogTitle>
            <DialogDescription>
              Paste this into the device's webhook auth field (or the on-prem relay agent config).
              You won't see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 font-mono text-xs break-all" data-testid="text-device-secret">
            {showSecret?.secret}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (showSecret) navigator.clipboard.writeText(showSecret.secret);
              toast({ title: "Copied to clipboard" });
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button onClick={() => setShowSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
