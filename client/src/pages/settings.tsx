import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Palette, Building2, FileText, Globe, Image, Mail, MessageSquare } from "lucide-react";

const settingsSchema = z.object({
  gymName: z.string().min(1, "Gym name is required"),
  appDisplayName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
  logoUrl: z.string().optional().or(z.literal("")),
  faviconUrl: z.string().optional().or(z.literal("")),
  domain: z.string().optional().or(z.literal("")),
  smsSenderId: z.string().max(6).optional().or(z.literal("")),
  invoiceHeader: z.string().optional().or(z.literal("")),
  invoiceFooter: z.string().optional().or(z.literal("")),
  emailTemplateBg: z.string().optional(),
  emailTemplateAccent: z.string().optional(),
  market: z.string().optional(),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { tenant, refetch } = useAuth();

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      gymName: tenant?.gymName || "",
      appDisplayName: tenant?.appDisplayName || "",
      email: tenant?.email || "",
      phone: tenant?.phone || "",
      address: tenant?.address || "",
      primaryColor: tenant?.primaryColor || "#1e40af",
      secondaryColor: tenant?.secondaryColor || "#3b82f6",
      logoUrl: (tenant as any)?.logoUrl || "",
      faviconUrl: (tenant as any)?.faviconUrl || "",
      domain: (tenant as any)?.domain || "",
      smsSenderId: (tenant as any)?.smsSenderId || "",
      invoiceHeader: (tenant as any)?.invoiceHeader || "",
      invoiceFooter: (tenant as any)?.invoiceFooter || "",
      emailTemplateBg: (tenant as any)?.emailTemplateBg || "#ffffff",
      emailTemplateAccent: (tenant as any)?.emailTemplateAccent || "#1e40af",
      market: (tenant as any)?.market || "uae",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof settingsSchema>) => {
      const res = await apiRequest("PATCH", "/api/tenant/settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated successfully" });
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-2xl" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your gym's branding and information</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Gym Information</CardTitle>
                  <CardDescription>Basic details about your gym</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="gymName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gym Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-gym-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appDisplayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Custom app name" {...field} data-testid="input-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="market"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market / Region</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "uae"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-market">
                          <SelectValue placeholder="Select market" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="uae">UAE (AED, VAT 5%)</SelectItem>
                        <SelectItem value="india">India (INR, GST 18%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-settings-email" />
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
                        <Input {...field} data-testid="input-settings-phone" />
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
                      <Input {...field} data-testid="input-settings-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                  <Palette className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Branding</CardTitle>
                  <CardDescription>Customize your gym's color theme</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="h-9 w-12 rounded-md border cursor-pointer"
                            data-testid="input-primary-color"
                          />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="h-9 w-12 rounded-md border cursor-pointer"
                            data-testid="input-secondary-color"
                          />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4 p-4 rounded-md border">
                <p className="text-sm text-muted-foreground mb-2">Preview</p>
                <div className="flex gap-3">
                  <div
                    className="h-10 w-10 rounded-md"
                    style={{ backgroundColor: form.watch("primaryColor") }}
                  />
                  <div
                    className="h-10 w-10 rounded-md"
                    style={{ backgroundColor: form.watch("secondaryColor") }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <Image className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Advanced Branding</CardTitle>
                  <CardDescription>Logo, favicon, domain, and invoice customization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/logo.png" {...field} data-testid="input-logo-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="faviconUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Favicon URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/favicon.ico" {...field} data-testid="input-favicon-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        Custom Domain
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="yourgym.example.com" {...field} data-testid="input-domain" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="smsSenderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        SMS Sender ID
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="GYMFIT" maxLength={6} {...field} data-testid="input-sms-sender-id" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="invoiceHeader"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Invoice Header
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder="Custom text for invoice headers..." {...field} data-testid="input-invoice-header" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceFooter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Invoice Footer
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder="Custom text for invoice footers..." {...field} data-testid="input-invoice-footer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Email Template</CardTitle>
                  <CardDescription>Customize email appearance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emailTemplateBg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Background Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={field.value || "#ffffff"}
                            onChange={field.onChange}
                            className="h-9 w-12 rounded-md border cursor-pointer"
                            data-testid="input-email-bg-color"
                          />
                          <Input {...field} className="flex-1" data-testid="input-email-bg-text" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emailTemplateAccent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Accent Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={field.value || "#1e40af"}
                            onChange={field.onChange}
                            className="h-9 w-12 rounded-md border cursor-pointer"
                            data-testid="input-email-accent-color"
                          />
                          <Input {...field} className="flex-1" data-testid="input-email-accent-text" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-4 p-4 rounded-md border" data-testid="email-template-preview">
                <p className="text-sm text-muted-foreground mb-3">Preview</p>
                <div
                  className="rounded-md p-6 border"
                  style={{ backgroundColor: form.watch("emailTemplateBg") || "#ffffff" }}
                >
                  <div
                    className="rounded-md p-4 mb-3"
                    style={{ backgroundColor: form.watch("emailTemplateAccent") || "#1e40af" }}
                  >
                    <p className="text-sm font-semibold text-white">{tenant?.gymName || "Your Gym"}</p>
                  </div>
                  <div className="space-y-2 px-1">
                    <p className="text-sm font-medium" style={{ color: "#333333" }}>Welcome to your gym!</p>
                    <p className="text-xs" style={{ color: "#666666" }}>
                      This is a preview of how your emails will look with the selected colors.
                    </p>
                    <div
                      className="inline-block rounded-md px-4 py-2 mt-2"
                      style={{ backgroundColor: form.watch("emailTemplateAccent") || "#1e40af" }}
                    >
                      <span className="text-xs font-medium text-white">Action Button</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
