import { createContext, useContext, useState, useEffect } from "react";
import type { User, Tenant } from "@shared/schema";
import { apiRequest } from "./queryClient";
import { applyTenantBranding } from "@/components/theme-provider";

type AuthUser = Omit<User, "password">;

type AuthContextType = {
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const brandingRes = await fetch("/api/branding");
      if (brandingRes.ok) {
        const branding = await brandingRes.json();
        if (branding.primaryColor) {
          applyTenantBranding(branding.primaryColor, branding.secondaryColor);
        }
        if (branding.faviconUrl) {
          const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
          if (link) link.href = branding.faviconUrl;
        }
      }
    } catch {}
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTenant(data.tenant);
        if (data.tenant) {
          applyTenantBranding(data.tenant.primaryColor, data.tenant.secondaryColor);
        }
      } else {
        setUser(null);
        setTenant(null);
      }
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    if (data.tenant) {
      applyTenantBranding(data.tenant.primaryColor, data.tenant.secondaryColor);
    }
    const role = data.user?.role;
    const dashboardMap: Record<string, string> = {
      platform_admin: "/admin",
      member: "/portal",
      trainer: "/portal",
      manager: "/dashboard",
      gym_owner: "/dashboard",
      sales_executive: "/dashboard",
    };
    const target = dashboardMap[role] || "/dashboard";
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setTenant(data.tenant);
    setUser(data.user);
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
    setTenant(null);
    const root = document.documentElement;
    root.style.removeProperty("--primary");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--accent");
    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <AuthContext.Provider value={{ user, tenant, isLoading, login, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
