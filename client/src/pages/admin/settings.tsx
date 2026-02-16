import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Globe, Server, Database } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-admin-settings">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Fitro360 platform</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Domain Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Primary Domain</label>
              <Input value="fitro360.com" disabled className="mt-1.5" data-testid="input-primary-domain" />
              <p className="text-xs text-muted-foreground mt-1">This is your platform's main domain</p>
            </div>
            <div>
              <label className="text-sm font-medium">Subdomain Pattern</label>
              <div className="flex items-center gap-0 mt-1.5">
                <span className="inline-flex items-center px-3 h-9 bg-muted border rounded-l-md text-sm text-muted-foreground">*.fitro360.com</span>
                <Badge variant="outline" className="rounded-l-none h-9 bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tenants can be accessed via their subdomain (e.g., gymname.fitro360.com)</p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium">Wildcard DNS</label>
              <p className="text-sm text-muted-foreground mt-1">
                For subdomain routing to work, add a wildcard A record:
              </p>
              <div className="mt-2 p-3 rounded-md bg-muted font-mono text-sm">
                *.fitro360.com → A → [Your Server IP]
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Session Secret</label>
              <Input value="••••••••••••••••" disabled className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Set via environment variable SESSION_SECRET</p>
            </div>
            <div>
              <label className="text-sm font-medium">Password Hashing</label>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">bcrypt (10 rounds)</Badge>
              </div>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium">Stripe Integration</label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Stripe for payment processing by setting STRIPE_SECRET_KEY environment variable.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/40">
                <Server className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              Platform Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">Fitro360 SaaS</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Runtime</span>
              <span className="font-medium">Node.js + Express</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ORM</span>
              <span className="font-medium">Drizzle</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Frontend</span>
              <span className="font-medium">React + Vite</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Multi-tenant</span>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Enabled</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/40">
                <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Supported Markets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-md border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">UAE</p>
                  <p className="text-xs text-muted-foreground">Currency: AED, Tax: VAT 5%</p>
                </div>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
              </div>
            </div>
            <div className="p-3 rounded-md border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">India</p>
                  <p className="text-xs text-muted-foreground">Currency: INR (₹), Tax: GST 18%</p>
                </div>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
