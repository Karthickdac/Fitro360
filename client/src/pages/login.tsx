import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import {
  Dumbbell,
  Eye,
  EyeOff,
  Loader2,
  Zap,
  Users,
  Shield,
  BarChart3,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Globe,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type BrandingInfo = {
  gymName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

const features = [
  { icon: Users, label: "Member Management", desc: "Track members, progress & attendance" },
  { icon: BarChart3, label: "Advanced Analytics", desc: "Real-time insights & forecasting" },
  { icon: Shield, label: "Bank-Grade Security", desc: "Multi-tenant data isolation" },
  { icon: Zap, label: "Smart Scheduling", desc: "AI-powered trainer assignment" },
];

const trustBadges = [
  "UAE VAT Compliant",
  "FTA Certified",
  "ISO 27001",
  "GDPR Ready",
];

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);

  useEffect(() => {
    fetch("/api/branding").then(r => r.json()).then(data => {
      if (data.gymName && data.gymName !== "Fitro360") {
        setBranding(data);
      }
    }).catch(() => {});
  }, []);

  const form = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginFormSchema>) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = branding?.gymName || "Fitro360";
  const isSubdomain = !!branding;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0a0612]" data-testid="page-login">
      {/* Desktop Left Panel */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Aurora gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0612] via-[#1a0b2e] to-[#0a0612]" />
        <div className="absolute inset-0">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-fuchsia-500/20 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 left-1/4 w-[450px] h-[450px] bg-indigo-600/25 rounded-full blur-[110px]" />
          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Top noise overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-transparent to-black/40" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo header */}
          <div className="flex items-center gap-3" data-testid="logo-header">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 via-violet-500 to-violet-700 shadow-lg shadow-violet-500/40 ring-1 ring-violet-300/30">
                <Dumbbell className="h-6 w-6 text-white" strokeWidth={2.5} />
                <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-violet-200" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-white tracking-tight">{displayName}</span>
              {!isSubdomain && (
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-violet-300/80">
                  Enterprise Suite
                </span>
              )}
            </div>
          </div>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center max-w-xl py-12">
            {/* Eyebrow badge */}
            {!isSubdomain && (
              <div
                className="inline-flex items-center gap-2 self-start px-3 py-1.5 mb-6 rounded-full bg-white/5 border border-violet-400/20 backdrop-blur-sm"
                data-testid="badge-eyebrow"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
                </span>
                <span className="text-xs font-medium text-violet-200">
                  Trusted by 1,000+ gyms across UAE & India
                </span>
              </div>
            )}

            <h1
              className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight mb-6"
              data-testid="text-hero-title"
            >
              {isSubdomain ? (
                <span className="text-white">Welcome to <br />
                  <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </span>
              ) : (
                <span className="text-white">
                  The <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">enterprise</span> way to run your <br />gym empire
                </span>
              )}
            </h1>
            <p className="text-base xl:text-lg text-violet-100/60 leading-relaxed mb-10 max-w-lg">
              {isSubdomain
                ? "Sign in to access your gym management portal."
                : "All-in-one operating system for modern fitness businesses — members, finance, tax compliance, and analytics in one elegant platform."
              }
            </p>

            {!isSubdomain && (
              <div className="grid grid-cols-2 gap-3" data-testid="section-features">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="group relative flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-violet-400/30 transition-all"
                    data-testid={`card-feature-${i}`}
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/0 to-violet-500/0 group-hover:from-violet-500/5 group-hover:to-fuchsia-500/5 transition-all" />
                    <div className="relative flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 ring-1 ring-violet-400/20 flex items-center justify-center">
                      <f.icon className="h-4.5 w-4.5 text-violet-300" />
                    </div>
                    <div className="relative">
                      <div className="text-sm font-semibold text-white">{f.label}</div>
                      <div className="text-xs text-violet-200/50 mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer stats + trust */}
          {!isSubdomain && (
            <div className="space-y-5" data-testid="section-stats">
              <div className="flex items-center gap-8">
                <div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-3xl font-bold text-white" data-testid="text-stat-gyms">1,000</div>
                    <span className="text-xl font-bold text-violet-400">+</span>
                  </div>
                  <div className="text-[10px] text-violet-200/50 font-semibold uppercase tracking-widest mt-0.5">Gyms Powered</div>
                </div>
                <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
                <div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-3xl font-bold text-white" data-testid="text-stat-members">50K</div>
                    <span className="text-xl font-bold text-violet-400">+</span>
                  </div>
                  <div className="text-[10px] text-violet-200/50 font-semibold uppercase tracking-widest mt-0.5">Active Members</div>
                </div>
                <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
                <div>
                  <div className="text-3xl font-bold text-white" data-testid="text-stat-uptime">99.99%</div>
                  <div className="text-[10px] text-violet-200/50 font-semibold uppercase tracking-widest mt-0.5">Uptime SLA</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {trustBadges.map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-medium text-violet-200/70"
                    data-testid={`badge-trust-${badge.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    {badge}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Hero Section */}
      <div className="lg:hidden relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0612] via-[#1a0b2e] to-[#0a0612]" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-fuchsia-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col items-center text-center" data-testid="mobile-hero">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={displayName} className="h-14 w-14 rounded-2xl object-cover mb-4 shadow-lg ring-1 ring-white/10" />
          ) : (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-violet-500 to-violet-700 shadow-lg shadow-violet-500/40 ring-1 ring-violet-300/30 mb-4">
              <Dumbbell className="h-7 w-7 text-white" strokeWidth={2.5} />
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-violet-200" />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white tracking-tight" data-testid="mobile-logo">{displayName}</h1>
          {!isSubdomain && (
            <>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-violet-300/80 mt-1.5">Enterprise Suite</p>
              <p className="text-sm text-violet-200/60 mt-3 max-w-xs">The operating system for modern fitness businesses.</p>
            </>
          )}
          {isSubdomain && (
            <p className="text-sm text-violet-200/60 mt-2">Welcome back</p>
          )}
        </div>

        <div className="relative z-10 h-5 bg-background rounded-t-[2rem]" />
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background relative overflow-hidden">
        {/* Animated ambient orbs */}
        <div className="absolute top-0 right-0 w-[460px] h-[460px] bg-primary/[0.06] dark:bg-primary/[0.08] rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none animate-float-slow" />
        <div className="absolute bottom-0 left-0 w-[340px] h-[340px] bg-violet-500/[0.05] dark:bg-violet-500/[0.06] rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none animate-float-slower" />
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-fuchsia-500/[0.03] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        {/* Subtle dot grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Animated card frame */}
          <div className="relative">
            {/* Halo gradient ring (focus-within highlights) */}
            <div
              aria-hidden
              className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/30 via-violet-500/10 to-fuchsia-500/20 opacity-0 group-[.is-focused]:opacity-100 transition-opacity duration-500 pointer-events-none blur-md"
            />

            {/* Form header */}
            <div
              className="mb-7 lg:mt-0 -mt-2 lg:text-left text-center animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <div
                className="group/badge inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 lg:flex lg:w-fit hover:bg-primary/15 hover:border-primary/30 hover:shadow-[0_0_18px_rgba(167,139,250,0.25)] transition-all cursor-default"
                data-testid="badge-secure-signin"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <Globe className="h-3 w-3 text-primary group-hover/badge:rotate-[20deg] transition-transform duration-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Secure Sign In</span>
              </div>
              <h2
                className="text-3xl font-bold tracking-tight inline-flex items-baseline gap-1"
                data-testid="text-login-heading"
              >
                <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Welcome back
                </span>
                <span aria-hidden className="inline-block w-[3px] h-7 bg-primary rounded-sm animate-caret-blink translate-y-1" />
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Enter your credentials to access your workspace.
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-700"
                style={{ animationDelay: "80ms", animationFillMode: "both" }}
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="group/field">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-foreground/70 group-focus-within/field:text-primary transition-colors">
                        Username
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          {/* Focus ring glow */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -inset-px rounded-md bg-gradient-to-r from-primary/40 via-violet-500/20 to-fuchsia-500/30 opacity-0 group-focus-within/field:opacity-100 blur-md transition-opacity duration-300"
                          />
                          <Input
                            placeholder="Enter your username"
                            autoComplete="username"
                            className="relative h-11 px-4 text-sm bg-card/60 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 hover:border-border transition-colors"
                            {...field}
                            data-testid="input-username"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="group/field">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-foreground/70 group-focus-within/field:text-primary transition-colors">
                          Password
                        </FormLabel>
                        <button
                          type="button"
                          className="text-[11px] font-medium text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors"
                          data-testid="link-forgot-password"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -inset-px rounded-md bg-gradient-to-r from-primary/40 via-violet-500/20 to-fuchsia-500/30 opacity-0 group-focus-within/field:opacity-100 blur-md transition-opacity duration-300"
                          />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="relative h-11 px-4 pr-11 text-sm bg-card/60 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 hover:border-border transition-colors"
                            {...field}
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute z-10 right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 transition-all"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="group/btn relative w-full h-12 text-sm font-semibold overflow-hidden bg-gradient-to-r from-primary via-violet-500 to-violet-600 hover:from-primary hover:via-violet-500 hover:to-violet-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] transition-all duration-200"
                  disabled={isLoading}
                  data-testid="button-login"
                  style={branding?.primaryColor ? { backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})` } : undefined}
                >
                  {/* Shine sweep on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover/btn:opacity-100 group-hover/btn:animate-shine-sweep"
                  />
                  {isLoading ? (
                    <span className="relative inline-flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="relative inline-flex items-center">
                      Sign in to dashboard
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </span>
                  )}
                </Button>
              </form>
            </Form>

            {!isSubdomain && (
              <div
                className="mt-7 p-4 rounded-xl bg-gradient-to-br from-card/70 to-card/30 border border-border/60 backdrop-blur-sm lg:text-left text-center hover:border-primary/30 hover:shadow-[0_0_24px_-12px_rgba(167,139,250,0.5)] transition-all animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: "180ms", animationFillMode: "both" }}
                data-testid="section-demo-accounts"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <p className="text-[10px] text-foreground/70 font-bold uppercase tracking-widest">Demo Accounts</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium hidden lg:inline">
                    Click to autofill
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { role: "Owner", username: "gymowner", password: "gym123" },
                    { role: "Manager", username: "manager1", password: "manager123" },
                    { role: "Trainer", username: "trainer1", password: "trainer123" },
                    { role: "Member", username: "member1", password: "member123" },
                  ].map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => {
                        form.setValue("username", acc.username, { shouldValidate: false });
                        form.setValue("password", acc.password, { shouldValidate: false });
                      }}
                      className="group/demo flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left text-[11px] text-muted-foreground hover:bg-primary/5 hover:text-foreground border border-transparent hover:border-primary/20 active:scale-[0.98] transition-all"
                      data-testid={`button-demo-${acc.role.toLowerCase()}`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-foreground/85">{acc.role}:</span>{" "}
                        <span className="font-mono">{acc.username}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-primary/0 group-hover/demo:text-primary group-hover/demo:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isSubdomain && (
              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                By signing in you agree to our{" "}
                <a href="#" className="text-primary hover:underline underline-offset-2">Terms</a> &{" "}
                <a href="#" className="text-primary hover:underline underline-offset-2">Privacy Policy</a>
              </p>
            )}

            {isSubdomain && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Powered by <span className="font-bold text-primary">Fitro360</span>
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
