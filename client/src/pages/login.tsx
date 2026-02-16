import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
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
    <div className="min-h-screen flex" data-testid="page-login">
      <div className="hidden lg:flex lg:flex-1 relative">
        <img
          src="/images/gym-hero.png"
          alt="Gym"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-6">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/20"
                style={branding?.primaryColor ? { backgroundColor: branding.primaryColor + "33" } : undefined}
              >
                <Dumbbell className="h-7 w-7 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
          </div>
          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            {isSubdomain
              ? `Welcome to ${displayName}. Sign in to access your gym management portal.`
              : "The complete white-label gym management platform. Power your fitness business with enterprise-grade tools."
            }
          </p>
          {!isSubdomain && (
            <div className="flex gap-6 mt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">1000+</div>
                <div className="text-sm text-white/60">Gyms Powered</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">50K+</div>
                <div className="text-sm text-white/60">Active Members</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">99.9%</div>
                <div className="text-sm text-white/60">Uptime</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary"
                style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : undefined}
              >
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                className="w-full"
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
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          {!isSubdomain && (
            <div className="mt-8 p-4 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium mb-2">Demo Accounts:</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium">Platform Admin:</span> admin / admin123</p>
                <p><span className="font-medium">Gym Owner:</span> gymowner / gym123</p>
                <p><span className="font-medium">Trainer:</span> trainer1 / trainer123</p>
              </div>
            </div>
          )}

          {isSubdomain && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Powered by Fitro360
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
