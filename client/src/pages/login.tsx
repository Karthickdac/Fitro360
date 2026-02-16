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
import { Dumbbell, Eye, EyeOff, Loader2, Zap, Users, Shield, BarChart3, ArrowRight } from "lucide-react";
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
  { icon: BarChart3, label: "Analytics & Reports", desc: "Real-time insights for your gym" },
  { icon: Shield, label: "Multi-Tenant Security", desc: "Isolated data per gym tenant" },
  { icon: Zap, label: "Instant Scheduling", desc: "Drag & drop trainer sessions" },
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
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="page-login">
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-4" data-testid="logo-header">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                <Dumbbell className="h-8 w-8 text-white" />
              </div>
            )}
            <span className="text-3xl font-extrabold text-white tracking-tight">{displayName}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4" data-testid="text-hero-title">
              {isSubdomain
                ? `Welcome to ${displayName}`
                : "Power Your Fitness Business"
              }
            </h1>
            <p className="text-lg text-blue-100/70 leading-relaxed mb-10">
              {isSubdomain
                ? "Sign in to access your gym management portal."
                : "Complete gym management platform with multi-tenant support, real-time analytics, and powerful scheduling tools."
              }
            </p>

            {!isSubdomain && (
              <div className="grid grid-cols-2 gap-4" data-testid="section-features">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm" data-testid={`card-feature-${i}`}>
                    <div className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <f.icon className="h-4.5 w-4.5 text-blue-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{f.label}</div>
                      <div className="text-xs text-blue-200/50 mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isSubdomain && (
            <div className="flex items-center gap-8" data-testid="section-stats">
              <div>
                <div className="text-3xl font-bold text-white" data-testid="text-stat-gyms">1000+</div>
                <div className="text-xs text-blue-200/50 font-medium uppercase tracking-wider mt-1">Gyms Powered</div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <div className="text-3xl font-bold text-white" data-testid="text-stat-members">50K+</div>
                <div className="text-xs text-blue-200/50 font-medium uppercase tracking-wider mt-1">Active Members</div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <div className="text-3xl font-bold text-white" data-testid="text-stat-uptime">99.9%</div>
                <div className="text-xs text-blue-200/50 font-medium uppercase tracking-wider mt-1">Uptime</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="w-full max-w-[380px] relative z-10">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary"
                style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
              >
                <Dumbbell className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight">{displayName}</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-login-heading">Welcome back</h2>
            <p className="text-muted-foreground mt-2 text-sm">Sign in to your account to continue</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username"
                        {...field}
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pr-10"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                className="w-full text-sm font-semibold"
                disabled={isLoading}
                data-testid="button-login"
                style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          {!isSubdomain && (
            <div className="mt-8 p-4 rounded-xl bg-muted/40 border border-border/50" data-testid="section-demo-accounts">
              <p className="text-xs text-muted-foreground font-semibold mb-2.5 uppercase tracking-wider">Demo Accounts</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground/70">Gym Owner:</span> gymowner / gym123</p>
                <p><span className="font-medium text-foreground/70">Trainer:</span> trainer1 / trainer123</p>
                <p><span className="font-medium text-foreground/70">Member:</span> member1 / member123</p>
              </div>
            </div>
          )}

          {isSubdomain && (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Powered by <span className="font-semibold">Fitro360</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
