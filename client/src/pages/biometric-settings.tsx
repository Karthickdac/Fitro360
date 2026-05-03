import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Trash2, Loader2 } from "lucide-react";

type Settings = {
  tenantId: string;
  templateRetentionMonths: number;
  eventRetentionMonths: number;
  purgeOnCancellation: boolean;
  relayWsEnabled: boolean;
};

const formSchema = z.object({
  templateRetentionMonths: z.coerce.number().int().min(1).max(120),
  eventRetentionMonths: z.coerce.number().int().min(1).max(120),
  purgeOnCancellation: z.boolean(),
  relayWsEnabled: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

export default function BiometricSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Settings>({ queryKey: ["/api/biometric/settings"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateRetentionMonths: 24,
      eventRetentionMonths: 12,
      purgeOnCancellation: false,
      relayWsEnabled: true,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        templateRetentionMonths: data.templateRetentionMonths,
        eventRetentionMonths: data.eventRetentionMonths,
        purgeOnCancellation: data.purgeOnCancellation,
        relayWsEnabled: data.relayWsEnabled,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("PUT", "/api/biometric/settings", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/settings"] });
      toast({ title: "Retention settings saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const sweepMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/biometric/retention/run", {});
      return res.json();
    },
    onSuccess: (r: any) => {
      toast({
        title: "GDPR sweep complete",
        description: `${r.templatesDeleted ?? 0} template(s) purged, ${r.eventsWiped ?? 0} event payload(s) wiped, ${r.unmatchedDeleted ?? 0} unmatched cleared`,
      });
    },
    onError: (e: any) => toast({ title: "Sweep failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-title">Biometric Retention &amp; GDPR</h1>
          <p className="text-sm text-muted-foreground">
            Configure how long face / fingerprint templates and access events are kept before automatic deletion.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention policy</CardTitle>
          <CardDescription>
            A daily background job enforces these limits. Templates for members who have been
            inactive or transferred for more than 30 days are always deleted, regardless of these
            settings, to satisfy GDPR / UAE PDPL "right to be forgotten" requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="templateRetentionMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template retention (months)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={120} {...field} data-testid="input-template-months" />
                      </FormControl>
                      <FormDescription>
                        Maximum age of a biometric template after a member's membership ends. Default: 24.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventRetentionMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event payload retention (months)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={120} {...field} data-testid="input-event-months" />
                      </FormControl>
                      <FormDescription>
                        After this many months the raw device payload and captured photo are wiped from
                        access events. The decision (allow / deny / reason) is preserved for audit. Default: 12.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purgeOnCancellation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Purge templates immediately on cancellation</FormLabel>
                        <FormDescription>
                          Strict mode: skip the 30-day grace period and delete templates the moment a
                          member is marked cancelled / transferred / inactive.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-purge-on-cancel" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="relayWsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Allow live websocket feed for on-prem relay</FormLabel>
                        <FormDescription>
                          Disable to stop streaming access events over the websocket gateway.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-relay-ws" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sweepMutation.mutate()}
                    disabled={sweepMutation.isPending}
                    data-testid="button-run-sweep"
                  >
                    {sweepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Run GDPR sweep now
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-settings">
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the daily sweep does</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Deletes templates for members who have been inactive / transferred for more than 30 days, and pushes a delete-template command to the device that holds them.</p>
          <p>• Deletes templates whose owning member has been cancelled (immediately when strict-mode is on, otherwise after the 30-day grace period).</p>
          <p>• Wipes the raw device payload and captured photo from access events older than the event retention window. Decision metadata (allow / deny / reason / timestamp) is preserved for audit.</p>
          <p>• Removes unmatched device-side enrolments older than 90 days.</p>
          <p>• Writes an entry to the activity log so you can prove compliance to a regulator.</p>
        </CardContent>
      </Card>
    </div>
  );
}
