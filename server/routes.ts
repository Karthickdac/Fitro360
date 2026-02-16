import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { loginSchema, insertMemberSchema } from "@shared/schema";
import { z } from "zod";

const SESSION_SECRET = process.env.SESSION_SECRET || "forgefit-dev-secret";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = user;
  if (user.tenantId) {
    (req as any).tenant = await storage.getTenant(user.tenantId);
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      let tenant = null;
      if (user.tenantId) {
        tenant = await storage.getTenant(user.tenantId);
      }

      return res.json({ user: safeUser, tenant });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const { password: _, ...safeUser } = user;
    let tenant = null;
    if (user.tenantId) {
      tenant = await storage.getTenant(user.tenantId);
    }

    return res.json({ user: safeUser, tenant });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ message: "Logged out" });
  });

  app.get("/api/dashboard/stats", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) {
      return res.status(400).json({ message: "No tenant associated" });
    }
    const stats = await storage.getDashboardStats(user.tenantId);
    return res.json(stats);
  });

  app.get("/api/members", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) {
      return res.json([]);
    }
    const membersList = await storage.getMembersByTenant(user.tenantId);
    return res.json(membersList);
  });

  app.post("/api/members", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) {
        return res.status(400).json({ message: "No tenant associated" });
      }

      const memberInput = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        membershipType: z.string().min(1),
        status: z.string().optional(),
      }).parse(req.body);

      const data = memberInput;
      const now = new Date();
      let membershipEnd: Date;

      switch (data.membershipType) {
        case "annual":
          membershipEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        case "quarterly":
          membershipEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case "day_pass":
          membershipEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        default:
          membershipEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const member = await storage.createMember({
        ...data,
        tenantId: user.tenantId,
        membershipStart: now,
        membershipEnd,
        status: "active",
      });

      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "member_added",
        description: `${data.firstName} ${data.lastName} was added as a new member`,
      });

      return res.json(member);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/trainers", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) {
      return res.json([]);
    }
    const trainerList = await storage.getUsersByRole(user.tenantId, "trainer");
    const safeTrainers = trainerList.map(({ password: _, ...rest }) => rest);
    return res.json(safeTrainers);
  });

  app.get("/api/activities", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) {
      return res.json([]);
    }
    const activityList = await storage.getActivities(user.tenantId);
    return res.json(activityList);
  });

  app.patch("/api/tenant/settings", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) {
        return res.status(400).json({ message: "No tenant associated" });
      }

      const updated = await storage.updateTenant(user.tenantId, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/stats", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    const stats = await storage.getAdminStats();
    return res.json(stats);
  });

  app.get("/api/admin/tenants", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    const tenantList = await storage.getAllTenants();
    return res.json(tenantList);
  });

  app.post("/api/admin/tenants", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const { gymName, email, domain, subscriptionPlan, primaryColor, secondaryColor, ownerFirstName, ownerLastName, ownerUsername, ownerPassword } = req.body;

      const existingUser = await storage.getUserByUsername(ownerUsername);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const tenant = await storage.createTenant({
        gymName,
        email,
        domain: domain || null,
        subscriptionPlan,
        primaryColor,
        secondaryColor,
        appDisplayName: gymName,
        isActive: true,
      });

      const hashedPassword = await bcrypt.hash(ownerPassword, 10);
      await storage.createUser({
        tenantId: tenant.id,
        username: ownerUsername,
        email,
        password: hashedPassword,
        role: "gym_owner",
        firstName: ownerFirstName,
        lastName: ownerLastName,
        isActive: true,
      });

      return res.json(tenant);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/plans", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    const plans = await storage.getAllPlans();
    return res.json(plans);
  });

  return httpServer;
}
