import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { loginSchema, insertSupplierBillSchema, insertVatReturnSchema, insertCorporateTaxReturnSchema, insertFixedAssetSchema, insertMembershipTransferSchema } from "@shared/schema";
import { registerBiometricRoutes } from "./biometric/routes";
import { z } from "zod";
import {
  getUncachableStripeClient,
  getStripePublishableKey,
  isStripeReady,
} from "./stripeClient";

const SESSION_SECRET = process.env.SESSION_SECRET || "fitro360-dev-secret";

function paramId(req: Request): string {
  return req.params.id as string;
}

// Returns a trusted base URL for the running server. Never trusts the Host header
// from incoming requests (which is attacker-controllable) — important for OAuth-style
// redirect URLs returned to Stripe Checkout / Billing Portal.
function getTrustedBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT === "1" && process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

// Stripe prices are immutable. To update price we create new ones and store the latest IDs.
async function syncPlanToStripe(planId: string) {
  if (!isStripeReady()) throw new Error("Stripe not initialized");
  const plan = await storage.getPlan(planId);
  if (!plan) throw new Error("Plan not found");
  const stripe = await getUncachableStripeClient();

  let productId = plan.stripeProductId;
  const productPayload: any = {
    name: `Fitro360 ${plan.name}`,
    description: ((plan.features as string[]) || []).slice(0, 5).join(", ") || undefined,
    active: plan.isActive ?? true,
    metadata: { planId: plan.id, planName: plan.name },
  };
  if (productId) {
    try {
      await stripe.products.update(productId, productPayload);
    } catch {
      productId = null;
    }
  }
  if (!productId) {
    const created = await stripe.products.create(productPayload);
    productId = created.id;
  }

  const monthlyAmount = Math.round(Number(plan.priceMonthly) * 100);
  const annualAmount = Math.round(Number(plan.priceAnnual) * 100);

  let monthlyPriceId = plan.stripeMonthlyPriceId;
  let annualPriceId = plan.stripeAnnualPriceId;

  // Re-create price if amount changed (or none exists)
  const ensurePrice = async (
    existingId: string | null | undefined,
    amount: number,
    interval: "month" | "year",
  ) => {
    if (existingId) {
      try {
        const p = await stripe.prices.retrieve(existingId);
        if (
          p.unit_amount === amount &&
          p.recurring?.interval === interval &&
          p.active
        )
          return existingId;
        // archive the old one
        try {
          await stripe.prices.update(existingId, { active: false });
        } catch {}
      } catch {}
    }
    const created = await stripe.prices.create({
      product: productId!,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval },
    });
    return created.id;
  };

  monthlyPriceId = await ensurePrice(monthlyPriceId, monthlyAmount, "month");
  annualPriceId = await ensurePrice(annualPriceId, annualAmount, "year");

  return await storage.updatePlan(planId, {
    stripeProductId: productId,
    stripeMonthlyPriceId: monthlyPriceId,
    stripeAnnualPriceId: annualPriceId,
  } as any);
}

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
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // ─── Auth ──────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      let tenant = null;
      if (user.tenantId) tenant = await storage.getTenant(user.tenantId);
      return res.json({ user: safeUser, tenant });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { password: _, ...safeUser } = user;
    let tenant = null;
    if (user.tenantId) tenant = await storage.getTenant(user.tenantId);
    return res.json({ user: safeUser, tenant });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ message: "Logged out" });
  });

  // ─── Domain-based Branding ────────────────────────
  app.get("/api/branding", async (req: Request, res: Response) => {
    try {
      const host = req.headers.host || "";
      const domain = host.split(":")[0];
      let tenant = await storage.getTenantByDomain(domain);
      if (!tenant) {
        const parts = domain.split(".");
        if (parts.length >= 2) {
          const subdomain = parts[0];
          if (subdomain !== "www" && subdomain !== "admin") {
            tenant = await storage.getTenantBySubdomain(subdomain);
          }
        }
      }
      if (tenant) {
        return res.json({
          gymName: tenant.gymName,
          appDisplayName: tenant.appDisplayName,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          faviconUrl: (tenant as any).faviconUrl,
        });
      }
      return res.json({ gymName: "Fitro360", primaryColor: "#1e40af", secondaryColor: "#3b82f6" });
    } catch {
      return res.json({ gymName: "Fitro360", primaryColor: "#1e40af", secondaryColor: "#3b82f6" });
    }
  });

  // ─── Dashboard ─────────────────────────────────────────
  app.get("/api/dashboard/stats", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant associated" });
    const stats = await storage.getDashboardStats(user.tenantId);
    return res.json(stats);
  });

  // ─── Members ───────────────────────────────────────────
  app.get("/api/members", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const membersList = await storage.getMembersByTenant(user.tenantId);
    if (user.role === "trainer") {
      return res.json(membersList.filter((m: any) => m.trainerId === user.id));
    }
    return res.json(membersList);
  });

  app.get("/api/members/:id", authMiddleware, async (req: Request, res: Response) => {
    const member = await storage.getMember(paramId(req));
    if (!member) return res.status(404).json({ message: "Member not found" });
    return res.json(member);
  });

  app.post("/api/members", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant associated" });
      const memberInput = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        membershipPlanId: z.string().optional(),
        membershipType: z.string().min(1),
        status: z.string().optional(),
        trainerId: z.string().optional(),
        salespersonId: z.string().optional(),
        heightCm: z.string().optional(),
        weightKg: z.string().optional(),
        branchId: z.string().optional(),
        nationality: z.string().optional(),
        dateOfBirth: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyContactName: z.string().optional(),
        emergencyContactRelation: z.string().optional(),
        signatureDataUrl: z.string().optional(),
        waiverAccepted: z.boolean().optional(),
      }).parse(req.body);

      const now = new Date();
      let membershipEnd: Date;
      let durationDays: number | undefined;
      if (memberInput.membershipPlanId) {
        const plan = await storage.getMembershipPlan(memberInput.membershipPlanId);
        if (plan) durationDays = plan.durationDays;
      }
      if (durationDays) {
        membershipEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      } else {
        switch (memberInput.membershipType) {
          case "annual": membershipEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); break;
          case "quarterly": membershipEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); break;
          case "day_pass": membershipEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
          default: membershipEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }

      let bmi: string | undefined;
      if (memberInput.heightCm && memberInput.weightKg) {
        const h = parseFloat(memberInput.heightCm) / 100;
        const w = parseFloat(memberInput.weightKg);
        if (h > 0) bmi = (w / (h * h)).toFixed(1);
      }

      const { waiverAccepted, ...rest } = memberInput;
      const member = await storage.createMember({
        ...rest,
        tenantId: user.tenantId,
        membershipStart: now,
        membershipEnd,
        status: "active",
        bmi,
        waiverAcceptedAt: waiverAccepted ? now : undefined,
      } as any);

      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "member_added",
        description: `${memberInput.firstName} ${memberInput.lastName} was added as a new member`,
      });

      return res.json(member);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/members/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const member = await storage.getMember(paramId(req));
      if (!member || member.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Member not found" });
      }

      const data = { ...req.body };
      if (data.heightCm === "") data.heightCm = null;
      if (data.weightKg === "") data.weightKg = null;
      if (data.phone === "") data.phone = null;
      if (data.emergencyContact === "") data.emergencyContact = null;
      if (data.emergencyContactName === "") data.emergencyContactName = null;
      if (data.emergencyContactRelation === "") data.emergencyContactRelation = null;
      if (data.nationality === "") data.nationality = null;
      if (data.dateOfBirth === "") data.dateOfBirth = null;
      if (data.salespersonId === "") data.salespersonId = null;
      if (data.signatureDataUrl === "") data.signatureDataUrl = null;
      if (data.bmi === "") data.bmi = null;
      if (data.trainerId !== undefined && !["gym_owner", "manager", "platform_admin"].includes(user.role)) {
        return res.status(403).json({ message: "Only gym owners and managers can assign trainers" });
      }
      if (data.heightCm && data.weightKg) {
        const h = parseFloat(data.heightCm) / 100;
        const w = parseFloat(data.weightKg);
        if (h > 0) data.bmi = (w / (h * h)).toFixed(1);
      }

      if (data.status === "frozen" && member.status === "active") {
        await storage.createActivity({
          tenantId: user.tenantId,
          userId: user.id,
          type: "membership_frozen",
          description: `${member.firstName} ${member.lastName}'s membership was frozen`,
        });
      }

      if (data.status === "active" && member.status === "frozen") {
        await storage.createActivity({
          tenantId: user.tenantId,
          userId: user.id,
          type: "membership_unfrozen",
          description: `${member.firstName} ${member.lastName}'s membership was reactivated`,
        });
      }

      const updated = await storage.updateMember(paramId(req), data);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/members/:id/renew", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const member = await storage.getMember(paramId(req));
      if (!member || member.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Member not found" });
      }
      const now = new Date();
      let membershipEnd: Date;
      switch (member.membershipType) {
        case "annual": membershipEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); break;
        case "quarterly": membershipEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); break;
        default: membershipEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      const updated = await storage.updateMember(paramId(req), {
        membershipStart: now,
        membershipEnd,
        status: "active",
      });
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "member_renewed",
        description: `${member.firstName} ${member.lastName} renewed their ${member.membershipType} membership`,
      });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Attendance ────────────────────────────────────────
  app.get("/api/attendance", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const date = req.query.date as string | undefined;
    const list = await storage.getAttendanceByTenant(user.tenantId, date);
    return res.json(list);
  });

  app.post("/api/attendance/checkin", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const { memberId, method } = z.object({
        memberId: z.string().min(1),
        method: z.string().optional(),
      }).parse(req.body);

      const member = await storage.getMember(memberId);
      if (!member || member.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Member not found" });
      }

      const record = await storage.createAttendance({
        tenantId: user.tenantId,
        memberId,
        method: method || "manual",
        checkInTime: new Date(),
        branchId: member.branchId,
      });

      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "check_in",
        description: `${member.firstName} ${member.lastName} checked in`,
      });

      return res.json(record);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/attendance/:id/checkout", authMiddleware, async (req: Request, res: Response) => {
    const updated = await storage.updateAttendance(paramId(req), { checkOutTime: new Date() });
    return res.json(updated);
  });

  // ─── Trainer Sessions ─────────────────────────────────
  app.get("/api/sessions", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const list = await storage.getSessionsByTenant(user.tenantId, start, end);
    return res.json(list);
  });

  app.post("/api/sessions", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        trainerId: z.string().min(1),
        title: z.string().min(1),
        type: z.string().min(1),
        startTime: z.string().min(1),
        endTime: z.string().min(1),
        capacity: z.number().min(1).optional(),
        isRecurring: z.boolean().optional(),
        recurringPattern: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);

      const existingSessions = await storage.getSessionsByTrainer(input.trainerId);
      const conflict = existingSessions.find(s => {
        const sStart = new Date(s.startTime);
        const sEnd = new Date(s.endTime);
        return startTime < sEnd && endTime > sStart;
      });
      if (conflict) {
        return res.status(400).json({ message: "Trainer has a conflicting session at this time" });
      }

      const session = await storage.createSession({
        tenantId: user.tenantId,
        trainerId: input.trainerId,
        title: input.title,
        type: input.type,
        startTime,
        endTime,
        capacity: input.capacity || (input.type === "personal" ? 1 : 20),
        isRecurring: input.isRecurring || false,
        recurringPattern: input.recurringPattern,
        notes: input.notes,
        status: "scheduled",
      });

      return res.json(session);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const data = req.body;
      if (data.startTime) data.startTime = new Date(data.startTime);
      if (data.endTime) data.endTime = new Date(data.endTime);
      const updated = await storage.updateSession(paramId(req), data);
      if (!updated) return res.status(404).json({ message: "Session not found" });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
    await storage.deleteSession(paramId(req));
    return res.json({ message: "Deleted" });
  });

  app.post("/api/sessions/:id/book", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { memberId } = z.object({ memberId: z.string().min(1) }).parse(req.body);
      const session = await storage.getSession(paramId(req));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if ((session.enrolled || 0) >= (session.capacity || 1)) {
        return res.status(400).json({ message: "Session is full" });
      }
      const booking = await storage.createBooking({ sessionId: paramId(req), memberId, status: "confirmed" });
      return res.json(booking);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Trainers ──────────────────────────────────────────
  app.get("/api/trainers", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const trainerList = await storage.getUsersByRole(user.tenantId, "trainer");
    const profiles = await storage.getTrainerProfilesByTenant(user.tenantId);
    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    const result = trainerList.map(({ password: _, ...rest }) => ({
      ...rest,
      profile: profileMap.get(rest.id) || null,
    }));
    return res.json(result);
  });

  app.get("/api/trainers/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const trainer = await storage.getUser(paramId(req));
      if (!trainer || trainer.role !== "trainer" || trainer.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Trainer not found" });
      }
      const { password: _, ...safeTrainer } = trainer;
      const profile = await storage.getTrainerProfile(trainer.id);
      return res.json({ ...safeTrainer, profile: profile || null });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/trainers", authMiddleware, requireRole("gym_owner", "manager"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        username: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().optional(),
        bio: z.string().optional(),
        specializations: z.array(z.string()).optional().default([]),
        certifications: z.array(z.string()).optional().default([]),
        experienceYears: z.number().optional().default(0),
        hourlyRate: z.string().optional(),
        availability: z.string().optional(),
      }).parse(req.body);

      const hashed = await bcrypt.hash(input.password, 10);
      const newUser = await storage.createUser({
        tenantId: user.tenantId,
        username: input.username,
        email: input.email,
        password: hashed,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        role: "trainer",
        isActive: true,
      });

      const profile = await storage.createTrainerProfile({
        tenantId: user.tenantId,
        userId: newUser.id,
        bio: input.bio || null,
        specializations: input.specializations,
        certifications: input.certifications,
        experienceYears: input.experienceYears,
        hourlyRate: input.hourlyRate || null,
        availability: input.availability || null,
      });

      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "trainer_added",
        description: `Added trainer ${input.firstName} ${input.lastName}`,
      });

      const { password: _, ...safe } = newUser;
      return res.json({ ...safe, profile });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/trainers/:id", authMiddleware, requireRole("gym_owner", "manager"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const trainerId = paramId(req);
      const trainer = await storage.getUser(trainerId);
      if (!trainer || trainer.role !== "trainer" || trainer.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Trainer not found" });
      }

      const input = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
        bio: z.string().optional(),
        specializations: z.array(z.string()).optional(),
        certifications: z.array(z.string()).optional(),
        experienceYears: z.number().optional(),
        hourlyRate: z.string().optional(),
        availability: z.string().optional(),
      }).parse(req.body);

      const { bio, specializations, certifications, experienceYears, hourlyRate, availability, ...userData } = input;

      if (Object.keys(userData).length > 0) {
        await storage.updateUser(trainerId, userData as any);
      }

      const profileData: any = {};
      if (bio !== undefined) profileData.bio = bio;
      if (specializations !== undefined) profileData.specializations = specializations;
      if (certifications !== undefined) profileData.certifications = certifications;
      if (experienceYears !== undefined) profileData.experienceYears = experienceYears;
      if (hourlyRate !== undefined) profileData.hourlyRate = hourlyRate;
      if (availability !== undefined) profileData.availability = availability;

      let profile = await storage.getTrainerProfile(trainerId);
      if (Object.keys(profileData).length > 0) {
        if (profile) {
          profile = await storage.updateTrainerProfile(trainerId, profileData) || profile;
        } else {
          profile = await storage.createTrainerProfile({
            tenantId: user.tenantId!,
            userId: trainerId,
            ...profileData,
          });
        }
      }

      const updated = await storage.getUser(trainerId);
      if (!updated) return res.status(404).json({ message: "Not found" });
      const { password: _, ...safe } = updated;
      return res.json({ ...safe, profile });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Branches ──────────────────────────────────────────
  app.get("/api/branches", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getBranchesByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/branches", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      }).parse(req.body);
      const branch = await storage.createBranch({ ...input, tenantId: user.tenantId });
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "branch_added",
        description: `New branch "${input.name}" was added`,
      });
      return res.json(branch);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/branches/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    const updated = await storage.updateBranch(paramId(req), req.body);
    return res.json(updated);
  });

  app.delete("/api/branches/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    await storage.deleteBranch(paramId(req));
    return res.json({ message: "Deleted" });
  });

  // ─── Equipment ─────────────────────────────────────────
  app.get("/api/equipment", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getEquipmentByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/equipment", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        name: z.string().min(1),
        category: z.string().min(1),
        sku: z.string().optional(),
        quantity: z.number().optional(),
        minStock: z.number().optional(),
        costPrice: z.string().optional(),
        sellPrice: z.string().optional(),
        supplierId: z.string().optional(),
        branchId: z.string().optional(),
      }).parse(req.body);
      const item = await storage.createEquipment({ ...input, tenantId: user.tenantId });
      return res.json(item);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/equipment/:id", authMiddleware, async (req: Request, res: Response) => {
    const updated = await storage.updateEquipment(paramId(req), req.body);
    return res.json(updated);
  });

  app.delete("/api/equipment/:id", authMiddleware, async (req: Request, res: Response) => {
    await storage.deleteEquipment(paramId(req));
    return res.json({ message: "Deleted" });
  });

  // ─── Suppliers ─────────────────────────────────────────
  app.get("/api/suppliers", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getSuppliersByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/suppliers", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        name: z.string().min(1),
        contactPerson: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        taxNumber: z.string().optional(),
      }).parse(req.body);
      const supplier = await storage.createSupplier({ ...input, tenantId: user.tenantId });
      return res.json(supplier);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/suppliers/:id", authMiddleware, async (req: Request, res: Response) => {
    const updated = await storage.updateSupplier(paramId(req), req.body);
    return res.json(updated);
  });

  // ─── Invoices ──────────────────────────────────────────
  app.get("/api/invoices", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getInvoicesByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/invoices", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        type: z.string().optional(),
        customerId: z.string().optional(),
        items: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          total: z.number(),
        })),
        gstRate: z.string().optional(),
      }).parse(req.body);

      const subtotal = input.items.reduce((sum, i) => sum + i.total, 0);
      const tenantObj = (req as any).tenant;
      const defaultTaxRate = tenantObj?.market === "india" ? "18" : "5";
      const gstRate = parseFloat(input.gstRate || defaultTaxRate);
      const gstAmount = subtotal * (gstRate / 100);
      const total = subtotal + gstAmount;

      const allInvoices = await storage.getInvoicesByTenant(user.tenantId);
      const invoiceNumber = `INV-${String(allInvoices.length + 1).padStart(4, "0")}`;

      const invoice = await storage.createInvoice({
        tenantId: user.tenantId,
        invoiceNumber,
        type: input.type || "sale",
        customerId: input.customerId,
        items: input.items,
        subtotal: subtotal.toFixed(2),
        gstRate: gstRate.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: total.toFixed(2),
        status: "pending",
      });

      return res.json(invoice);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/invoices/:id", authMiddleware, async (req: Request, res: Response) => {
    const updated = await storage.updateInvoice(paramId(req), req.body);
    return res.json(updated);
  });

  // ─── Notifications ─────────────────────────────────────
  app.get("/api/notifications", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const list = user.tenantId
      ? await storage.getNotificationsByTenant(user.tenantId)
      : await storage.getNotificationsByUser(user.id);
    return res.json(list);
  });

  app.post("/api/notifications", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const input = z.object({
        type: z.string().min(1),
        title: z.string().min(1),
        message: z.string().min(1),
        userId: z.string().optional(),
        channel: z.string().optional(),
      }).parse(req.body);
      const notification = await storage.createNotification({
        ...input,
        tenantId: user.tenantId,
      });
      return res.json(notification);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    await storage.markNotificationRead(paramId(req));
    return res.json({ message: "Marked as read" });
  });

  // ─── Coupons ───────────────────────────────────────────
  app.get("/api/coupons", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getCouponsByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/coupons", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        code: z.string().min(1),
        description: z.string().optional(),
        discountType: z.string().min(1),
        discountValue: z.string().min(1),
        maxUses: z.number().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
      }).parse(req.body);
      const coupon = await storage.createCoupon({
        ...input,
        tenantId: user.tenantId,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      });
      return res.json(coupon);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/coupons/:id", authMiddleware, async (req: Request, res: Response) => {
    const updated = await storage.updateCoupon(paramId(req), req.body);
    return res.json(updated);
  });

  // ─── Referrals ─────────────────────────────────────────
  app.get("/api/referrals", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getReferralsByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/referrals", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        referrerId: z.string().min(1),
        referralCode: z.string().min(1),
        rewardType: z.string().optional(),
        rewardValue: z.string().optional(),
      }).parse(req.body);
      const referral = await storage.createReferral({
        ...input,
        tenantId: user.tenantId,
        status: "pending",
      });
      return res.json(referral);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Membership Plans ─────────────────────────────────
  app.get("/api/membership-plans", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const plans = await storage.getMembershipPlansByTenant(user.tenantId);
    return res.json(plans);
  });

  app.get("/api/membership-plans/:id", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const plan = await storage.getMembershipPlan(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (user.tenantId && plan.tenantId !== user.tenantId) return res.status(403).json({ message: "Not authorized" });
    return res.json(plan);
  });

  app.post("/api/membership-plans", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      if (!["gym_owner", "manager"].includes(user.role)) return res.status(403).json({ message: "Not authorized" });
      const input = z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        durationType: z.string().default("monthly"),
        durationDays: z.coerce.number().min(1).default(30),
        price: z.string().min(1),
        currency: z.string().default("AED"),
        setupFee: z.string().optional().nullable(),
        features: z.array(z.string()).optional().default([]),
        maxFreezeDays: z.coerce.number().optional().default(0),
        guestPasses: z.coerce.number().optional().default(0),
        personalTrainerSessions: z.coerce.number().optional().default(0),
        lockerAccess: z.boolean().optional().default(false),
        towelService: z.boolean().optional().default(false),
        groupClasses: z.boolean().optional().default(false),
        personalTraining: z.boolean().optional().default(false),
        color: z.string().optional().default("#6366f1"),
        isPopular: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true),
        sortOrder: z.coerce.number().optional().default(0),
      }).parse(req.body);
      const plan = await storage.createMembershipPlan({
        ...input,
        tenantId: user.tenantId,
      });
      return res.json(plan);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/membership-plans/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["gym_owner", "manager"].includes(user.role)) return res.status(403).json({ message: "Not authorized" });
      const existing = await storage.getMembershipPlan(req.params.id);
      if (!existing) return res.status(404).json({ message: "Plan not found" });
      if (user.tenantId && existing.tenantId !== user.tenantId) return res.status(403).json({ message: "Not authorized" });
      const plan = await storage.updateMembershipPlan(req.params.id, req.body);
      return res.json(plan);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/membership-plans/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!["gym_owner", "manager"].includes(user.role)) return res.status(403).json({ message: "Not authorized" });
      const existing = await storage.getMembershipPlan(req.params.id);
      if (!existing) return res.status(404).json({ message: "Plan not found" });
      if (user.tenantId && existing.tenantId !== user.tenantId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteMembershipPlan(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Activities ────────────────────────────────────────
  app.get("/api/activities", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const activityList = await storage.getActivities(user.tenantId);
    return res.json(activityList);
  });

  // ─── Analytics Export ──────────────────────────────────
  app.get("/api/analytics/export", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const type = req.query.type as string || "members";

      let data: any[] = [];
      let filename = "export.csv";
      let headers: string[] = [];

      if (type === "members") {
        data = await storage.getMembersByTenant(user.tenantId);
        headers = ["First Name", "Last Name", "Email", "Phone", "Membership Type", "Status", "Start Date", "End Date"];
        filename = "members_export.csv";
      } else if (type === "attendance") {
        data = await storage.getAttendanceByTenant(user.tenantId);
        headers = ["Member ID", "Check In", "Check Out", "Method"];
        filename = "attendance_export.csv";
      } else if (type === "equipment") {
        data = await storage.getEquipmentByTenant(user.tenantId);
        headers = ["Name", "Category", "SKU", "Quantity", "Cost Price", "Sell Price", "Status"];
        filename = "equipment_export.csv";
      } else if (type === "invoices") {
        data = await storage.getInvoicesByTenant(user.tenantId);
        headers = ["Invoice #", "Type", "Subtotal", "VAT", "Total", "Status", "Date"];
        filename = "invoices_export.csv";
      }

      let csv = headers.join(",") + "\n";
      data.forEach(row => {
        if (type === "members") {
          csv += `"${row.firstName}","${row.lastName}","${row.email}","${row.phone || ""}","${row.membershipType}","${row.status}","${row.membershipStart || ""}","${row.membershipEnd || ""}"\n`;
        } else if (type === "attendance") {
          csv += `"${row.memberId}","${row.checkInTime || ""}","${row.checkOutTime || ""}","${row.method || ""}"\n`;
        } else if (type === "equipment") {
          csv += `"${row.name}","${row.category}","${row.sku || ""}","${row.quantity || 0}","${row.costPrice || ""}","${row.sellPrice || ""}","${row.status || ""}"\n`;
        } else if (type === "invoices") {
          csv += `"${row.invoiceNumber}","${row.type}","${row.subtotal}","${row.gstAmount}","${row.total}","${row.status}","${row.createdAt || ""}"\n`;
        }
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── QR Code Check-in ────────────────────────────────
  app.get("/api/members/:id/qrcode", authMiddleware, async (req: Request, res: Response) => {
    try {
      const QRCode = require("qrcode");
      const member = await storage.getMember(paramId(req));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const qrData = JSON.stringify({ memberId: member.id, name: `${member.firstName} ${member.lastName}`, type: "checkin" });
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
      return res.json({ qrCode: qrDataUrl, memberId: member.id });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/attendance/qr-checkin", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const { memberId } = req.body;
      if (!memberId) return res.status(400).json({ message: "Member ID required" });
      const member = await storage.getMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
      if (member.tenantId !== user.tenantId) return res.status(403).json({ message: "Member does not belong to this gym" });
      const att = await storage.createAttendance({ tenantId: user.tenantId, memberId, method: "qr" });
      await storage.createActivity({ tenantId: user.tenantId, userId: user.id, type: "checkin", description: `QR check-in: ${member.firstName} ${member.lastName}` });
      return res.json(att);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Trainer Commissions ─────────────────────────
  app.get("/api/commissions", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const comms = await storage.getCommissionsByTenant(user.tenantId);
    return res.json(comms);
  });

  app.post("/api/commissions", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        trainerId: z.string().min(1),
        sessionId: z.string().optional(),
        amount: z.string().min(1),
        type: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const comm = await storage.createCommission({ tenantId: user.tenantId, ...input, status: "pending" });
      return res.json(comm);
    } catch (error: any) { return res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/commissions/:id", authMiddleware, async (req: Request, res: Response) => {
    const data = req.body;
    if (data.paidAt) data.paidAt = new Date(data.paidAt);
    const updated = await storage.updateCommission(paramId(req), data);
    return res.json(updated);
  });

  // ─── Trainer Leaves ─────────────────────────────
  app.get("/api/leaves", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const lvs = await storage.getLeavesByTenant(user.tenantId);
    return res.json(lvs);
  });

  app.post("/api/leaves", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        trainerId: z.string().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        reason: z.string().optional(),
      }).parse(req.body);
      const leave = await storage.createLeave({ tenantId: user.tenantId, trainerId: input.trainerId, startDate: new Date(input.startDate), endDate: new Date(input.endDate), reason: input.reason, status: "pending" });
      return res.json(leave);
    } catch (error: any) { return res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/leaves/:id", authMiddleware, async (req: Request, res: Response) => {
    const data = req.body;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const updated = await storage.updateLeave(paramId(req), data);
    return res.json(updated);
  });

  // ─── Member Metrics (Progress Tracking) ──────────────
  app.get("/api/members/:id/metrics", authMiddleware, async (req: Request, res: Response) => {
    const metrics = await storage.getMetricsByMember(paramId(req));
    return res.json(metrics);
  });

  app.post("/api/members/:id/metrics", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        heightCm: z.string().optional(),
        weightKg: z.string().optional(),
        bodyFatPct: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      let bmi: string | undefined;
      if (input.heightCm && input.weightKg) {
        const h = parseFloat(input.heightCm) / 100;
        const w = parseFloat(input.weightKg);
        if (h > 0) bmi = (w / (h * h)).toFixed(1);
      }
      const metric = await storage.createMemberMetric({
        tenantId: user.tenantId,
        memberId: paramId(req),
        ...input,
        bmi,
      });
      if (input.heightCm && input.weightKg) {
        await storage.updateMember(paramId(req), { heightCm: input.heightCm, weightKg: input.weightKg, bmi });
      }
      return res.json(metric);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Member Portal (Self-service) ──────────────────
  app.get("/api/member/me", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const member = await storage.getMemberByEmail(user.tenantId, user.email);
    if (!member) return res.status(404).json({ message: "Member profile not found" });
    return res.json(member);
  });

  app.patch("/api/member/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const member = await storage.getMemberByEmail(user.tenantId, user.email);
      if (!member) return res.status(404).json({ message: "Member profile not found" });
      const input = z.object({
        phone: z.string().optional(),
        emergencyContact: z.string().optional(),
        heightCm: z.string().optional(),
        weightKg: z.string().optional(),
      }).parse(req.body);
      const cleanInput: Record<string, any> = {};
      if (input.phone !== undefined) cleanInput.phone = input.phone || null;
      if (input.emergencyContact !== undefined) cleanInput.emergencyContact = input.emergencyContact || null;
      if (input.heightCm !== undefined) cleanInput.heightCm = input.heightCm || null;
      if (input.weightKg !== undefined) cleanInput.weightKg = input.weightKg || null;
      let bmi: string | undefined;
      if (input.heightCm && input.weightKg) {
        const h = parseFloat(input.heightCm) / 100;
        const w = parseFloat(input.weightKg);
        if (h > 0) bmi = (w / (h * h)).toFixed(1);
      }
      const updated = await storage.updateMember(member.id, { ...cleanInput, ...(bmi ? { bmi } : {}) });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/member/me/metrics", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const member = await storage.getMemberByEmail(user.tenantId, user.email);
    if (!member) return res.status(404).json({ message: "Member profile not found" });
    const metrics = await storage.getMetricsByMember(member.id);
    return res.json(metrics);
  });

  app.post("/api/member/me/metrics", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const member = await storage.getMemberByEmail(user.tenantId, user.email);
      if (!member) return res.status(404).json({ message: "Member profile not found" });
      const input = z.object({
        heightCm: z.string().optional(),
        weightKg: z.string().optional(),
        bodyFatPct: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      let bmi: string | undefined;
      if (input.heightCm && input.weightKg) {
        const h = parseFloat(input.heightCm) / 100;
        const w = parseFloat(input.weightKg);
        if (h > 0) bmi = (w / (h * h)).toFixed(1);
      }
      const metric = await storage.createMemberMetric({
        tenantId: user.tenantId,
        memberId: member.id,
        ...input,
        bmi,
      });
      if (input.heightCm && input.weightKg) {
        await storage.updateMember(member.id, { heightCm: input.heightCm, weightKg: input.weightKg, bmi });
      }
      return res.json(metric);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/member/me/attendance", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const member = await storage.getMemberByEmail(user.tenantId, user.email);
    if (!member) return res.status(404).json({ message: "Member profile not found" });
    const records = await storage.getAttendanceByMember(member.id);
    return res.json(records);
  });

  app.get("/api/member/me/bookings", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const member = await storage.getMemberByEmail(user.tenantId, user.email);
    if (!member) return res.status(404).json({ message: "Member profile not found" });
    const bookings = await storage.getBookingsByMember(member.id);
    return res.json(bookings);
  });

  app.post("/api/member/me/book/:sessionId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const member = await storage.getMemberByEmail(user.tenantId, user.email);
      if (!member) return res.status(404).json({ message: "Member profile not found" });
      const sessionId = req.params.sessionId as string;
      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.tenantId !== user.tenantId) return res.status(403).json({ message: "Access denied" });
      if (member.trainerId && session.trainerId !== member.trainerId) {
        return res.status(403).json({ message: "You can only book sessions with your assigned trainer" });
      }
      if ((session.enrolled || 0) >= (session.capacity || 1)) {
        return res.status(400).json({ message: "Session is full" });
      }
      const existingBookings = await storage.getBookingsByMember(member.id);
      if (existingBookings.some(b => b.sessionId === sessionId && b.status === "confirmed")) {
        return res.status(400).json({ message: "Already booked for this session" });
      }
      const booking = await storage.createBooking({ sessionId, memberId: member.id, status: "confirmed" });
      return res.json(booking);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/member/me/book/:bookingId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const member = await storage.getMemberByEmail(user.tenantId, user.email);
      if (!member) return res.status(404).json({ message: "Member profile not found" });
      const bookings = await storage.getBookingsByMember(member.id);
      const booking = bookings.find(b => b.id === req.params.bookingId);
      if (!booking) return res.status(403).json({ message: "Booking not found or access denied" });
      await storage.cancelBooking(req.params.bookingId as string);
      return res.json({ message: "Booking cancelled" });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Equipment Maintenance ─────────────────────────
  app.get("/api/maintenance", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const records = await storage.getMaintenanceByTenant(user.tenantId);
    return res.json(records);
  });

  app.post("/api/maintenance", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        equipmentId: z.string().min(1),
        type: z.string().min(1),
        description: z.string().min(1),
        scheduledDate: z.string().min(1),
        cost: z.string().optional(),
        assignedTo: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const record = await storage.createMaintenance({
        tenantId: user.tenantId,
        ...input,
        scheduledDate: new Date(input.scheduledDate),
        status: "scheduled",
      });
      return res.json(record);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/maintenance/:id", authMiddleware, async (req: Request, res: Response) => {
    const data = req.body;
    if (data.scheduledDate) data.scheduledDate = new Date(data.scheduledDate);
    if (data.completedDate) data.completedDate = new Date(data.completedDate);
    const updated = await storage.updateMaintenance(paramId(req), data);
    return res.json(updated);
  });

  // ─── Payment Records ──────────────────────────────
  app.get("/api/payments", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const payments = await storage.getPaymentsByTenant(user.tenantId);
    return res.json(payments);
  });

  app.post("/api/payments", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const input = z.object({
        memberId: z.string().optional(),
        invoiceId: z.string().optional(),
        amount: z.string().min(1),
        method: z.string().min(1),
        description: z.string().optional(),
        currency: z.string().optional(),
      }).parse(req.body);
      const payment = await storage.createPayment({
        tenantId: user.tenantId,
        ...input,
        status: "completed",
      });
      if (input.invoiceId) {
        await storage.updateInvoice(input.invoiceId, { status: "paid" });
      }
      const tenant = (req as any).tenant;
      const defaultCurrency = tenant?.market === "india" ? "INR" : "AED";
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "payment",
        description: `Payment of ${input.currency || defaultCurrency} ${input.amount} received via ${input.method}`,
      });
      return res.json(payment);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Stripe Payment Integration ─────────────────────
  app.post("/api/payments/create-checkout", authMiddleware, async (req: Request, res: Response) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(400).json({ message: "Stripe is not configured. Record payments manually or connect Stripe in settings." });
      }
      const stripe = require("stripe")(stripeKey);
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const tenant = (req as any).tenant;
      const { amount, currency, description, memberId, invoiceId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: currency || (tenant?.market === "india" ? "inr" : "aed"),
            product_data: { name: description || "Gym Payment" },
            unit_amount: Math.round(parseFloat(amount) * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${req.headers.origin || "http://localhost:5000"}/payments?success=true`,
        cancel_url: `${req.headers.origin || "http://localhost:5000"}/payments?cancelled=true`,
        metadata: { tenantId: user.tenantId, memberId: memberId || "", invoiceId: invoiceId || "" },
      });
      return res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripeKey || !webhookSecret) return res.status(400).json({ message: "Stripe not configured" });
      const stripe = require("stripe")(stripeKey);
      const sig = req.headers["stripe-signature"];
      const rawBody = (req as any).rawBody;
      if (!rawBody) return res.status(400).json({ message: "Missing raw body" });
      const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { tenantId, memberId, invoiceId } = session.metadata;
        if (tenantId) {
          await storage.createPayment({
            tenantId,
            memberId: memberId || undefined,
            invoiceId: invoiceId || undefined,
            amount: (session.amount_total / 100).toString(),
            currency: session.currency?.toUpperCase() || "AED",

            method: "card",
            status: "completed",
            stripePaymentId: session.payment_intent,
            description: "Stripe online payment",
          });
          if (invoiceId) {
            await storage.updateInvoice(invoiceId, { status: "paid" });
          }
        }
      }
      return res.json({ received: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Analytics Dashboard ──────────────────────────
  app.get("/api/analytics/dashboard", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const allMembers = await storage.getMembersByTenant(user.tenantId);
      const allPayments = await storage.getPaymentsByTenant(user.tenantId);
      const allEquipment = await storage.getEquipmentByTenant(user.tenantId);

      const now = new Date();
      const monthlyData: { month: string; members: number; revenue: number; attendance: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = d.toLocaleString("default", { month: "short" });
        const membersInMonth = allMembers.filter(m => {
          const created = new Date(m.createdAt!);
          return created <= monthEnd;
        }).length;
        const revenueInMonth = allPayments
          .filter(p => {
            const created = new Date(p.createdAt!);
            return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
          })
          .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
        monthlyData.push({ month: monthName, members: membersInMonth, revenue: revenueInMonth, attendance: Math.floor(Math.random() * 50 + 30) });
      }

      const membershipDist: Record<string, number> = {};
      allMembers.forEach(m => {
        membershipDist[m.membershipType] = (membershipDist[m.membershipType] || 0) + 1;
      });

      const statusDist: Record<string, number> = {};
      allMembers.forEach(m => {
        statusDist[m.status] = (statusDist[m.status] || 0) + 1;
      });

      const totalRevenue = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const inventoryValue = allEquipment.reduce((sum, e) => sum + (e.quantity || 0) * parseFloat(e.costPrice || "0"), 0);

      return res.json({
        monthlyData,
        membershipDistribution: Object.entries(membershipDist).map(([name, value]) => ({ name, value })),
        statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
        totalRevenue,
        inventoryValue,
        totalMembers: allMembers.length,
        activeMembers: allMembers.filter(m => m.status === "active").length,
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Tenant Settings ──────────────────────────────────
  app.patch("/api/tenant/settings", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant associated" });
      const updated = await storage.updateTenant(user.tenantId, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Platform Admin ────────────────────────────────────
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
      const { gymName, email, domain, subdomain, subscriptionPlan, primaryColor, secondaryColor, market, ownerFirstName, ownerLastName, ownerUsername, ownerPassword } = req.body;
      const existingUser = await storage.getUserByUsername(ownerUsername);
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
      const cleanSubdomain = subdomain ? subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, "") : null;
      if (cleanSubdomain) {
        const existingSub = await storage.getTenantBySubdomain(cleanSubdomain);
        if (existingSub) return res.status(400).json({ message: "Subdomain already in use" });
      }
      const tenant = await storage.createTenant({
        gymName, email,
        domain: domain || null,
        subdomain: cleanSubdomain || null,
        subscriptionPlan, primaryColor, secondaryColor,
        appDisplayName: gymName,
        market: market || "uae",
        isActive: true,
      });
      const hashedPassword = await bcrypt.hash(ownerPassword, 10);
      await storage.createUser({
        tenantId: tenant.id, username: ownerUsername, email,
        password: hashedPassword, role: "gym_owner",
        firstName: ownerFirstName, lastName: ownerLastName,
        isActive: true,
      });
      return res.json(tenant);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/tenants/:id", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const tenant = await storage.getTenant(id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const userCount = await storage.getTenantUserCount(tenant.id);
    const memberCount = await storage.getTenantMemberCount(tenant.id);
    const tenantUsers = await storage.getUsersByTenant(tenant.id);
    return res.json({ ...tenant, userCount, memberCount, users: tenantUsers });
  });

  app.patch("/api/admin/tenants/:id", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { gymName, email, domain, subdomain, subscriptionPlan, primaryColor, secondaryColor, market, isActive } = req.body;
      const cleanSubdomain = subdomain ? subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, "") : null;
      if (cleanSubdomain) {
        const existingSub = await storage.getTenantBySubdomain(cleanSubdomain);
        if (existingSub && existingSub.id !== id) {
          return res.status(400).json({ message: "Subdomain already in use" });
        }
      }
      const updated = await storage.updateTenant(id, {
        gymName, email,
        domain: domain || null,
        subdomain: cleanSubdomain || null,
        subscriptionPlan, primaryColor, secondaryColor,
        appDisplayName: gymName,
        market: market || "uae",
        isActive,
      });
      if (!updated) return res.status(404).json({ message: "Tenant not found" });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/tenants/:id", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteTenant(id);
      return res.json({ message: "Tenant deleted" });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/plans", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    const plans = await storage.getAllPlans();
    return res.json(plans);
  });

  app.post("/api/admin/plans", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const input = z.object({
        name: z.string().min(1),
        priceMonthly: z.string().min(1),
        priceAnnual: z.string().min(1),
        maxMembers: z.coerce.number().optional().nullable(),
        features: z.array(z.string()).optional().default([]),
        isPopular: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true),
      }).parse(req.body);
      const plan = await storage.createPlan(input);
      // Best-effort sync to Stripe
      try {
        await syncPlanToStripe(plan.id);
      } catch (e: any) {
        console.warn("[stripe] auto-sync failed for new plan:", e.message);
      }
      const fresh = await storage.getPlan(plan.id);
      return res.json(fresh);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/plans/:id", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const existing = await storage.getPlan(req.params.id);
      if (!existing) return res.status(404).json({ message: "Plan not found" });
      const plan = await storage.updatePlan(req.params.id, req.body);
      try {
        await syncPlanToStripe(req.params.id);
      } catch (e: any) {
        console.warn("[stripe] auto-sync failed for plan update:", e.message);
      }
      const fresh = await storage.getPlan(req.params.id);
      return res.json(fresh);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/plans/:id", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      const existing = await storage.getPlan(req.params.id);
      if (!existing) return res.status(404).json({ message: "Plan not found" });
      // Archive on Stripe (don't delete — preserves invoice history)
      if (existing.stripeProductId && isStripeReady()) {
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.products.update(existing.stripeProductId, { active: false });
        } catch (e: any) {
          console.warn("[stripe] archive on delete failed:", e.message);
        }
      }
      await storage.deletePlan(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/plans/:id/sync-stripe", authMiddleware, requireRole("platform_admin"), async (req: Request, res: Response) => {
    try {
      if (!isStripeReady()) return res.status(503).json({ message: "Stripe not initialized" });
      const plan = await syncPlanToStripe(req.params.id);
      return res.json(plan);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ============ TAX PROFILE ============
  app.get("/api/tax/profile", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    const tenant = (req as any).tenant;
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    return res.json({
      market: tenant.market,
      legalName: tenant.legalName,
      tradeLicenseNumber: tenant.tradeLicenseNumber,
      trn: tenant.trn,
      vatRegisteredOn: tenant.vatRegisteredOn,
      vatFilingFrequency: tenant.vatFilingFrequency,
      ctTrn: tenant.ctTrn,
      ctRegisteredOn: tenant.ctRegisteredOn,
      fyStartMonth: tenant.fyStartMonth,
    });
  });

  app.patch("/api/tax/profile", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    const tenant = (req as any).tenant;
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    try {
      const allowed: any = {};
      const fields = ["legalName", "tradeLicenseNumber", "trn", "vatRegisteredOn", "vatFilingFrequency", "ctTrn", "ctRegisteredOn", "fyStartMonth", "market"];
      for (const f of fields) if (f in req.body) allowed[f] = req.body[f];
      const updated = await storage.updateTenant(tenant.id, allowed);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ============ SUPPLIER BILLS ============
  app.get("/api/supplier-bills", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const bills = await storage.getSupplierBillsByTenant(user.tenantId);
    return res.json(bills);
  });

  app.post("/api/supplier-bills", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = insertSupplierBillSchema.parse({ ...req.body, tenantId: user.tenantId });
      const bill = await storage.createSupplierBill(data);
      return res.json(bill);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/supplier-bills/:id", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const existing = await storage.getSupplierBill(req.params.id);
      if (!existing) return res.status(404).json({ message: "Bill not found" });
      const updated = await storage.updateSupplierBill(req.params.id, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/supplier-bills/:id", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteSupplierBill(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ============ VAT RETURNS ============
  app.get("/api/vat/returns", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const rows = await storage.getVatReturnsByTenant(user.tenantId);
    return res.json(rows);
  });

  app.get("/api/vat/returns/:id", authMiddleware, async (req: Request, res: Response) => {
    const ret = await storage.getVatReturn(req.params.id);
    if (!ret) return res.status(404).json({ message: "Not found" });
    return res.json(ret);
  });

  app.post("/api/vat/compute", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { periodStart, periodEnd } = req.body;
      if (!periodStart || !periodEnd) return res.status(400).json({ message: "periodStart and periodEnd required" });
      const computed = await storage.computeVatReturn(user.tenantId, periodStart, periodEnd);
      return res.json(computed);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/vat/returns", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { periodStart, periodEnd, dueDate, notes } = req.body;
      if (!periodStart || !periodEnd) return res.status(400).json({ message: "periodStart and periodEnd required" });
      const computed = await storage.computeVatReturn(user.tenantId, periodStart, periodEnd);
      const data = insertVatReturnSchema.parse({
        tenantId: user.tenantId,
        periodStart,
        periodEnd,
        dueDate: dueDate || null,
        status: "draft",
        box1aSalesStandardAmount: String(computed.box1aSalesStandardAmount),
        box1aSalesStandardVat: String(computed.box1aSalesStandardVat),
        box2SalesZero: String(computed.box2SalesZero),
        box3SalesExempt: String(computed.box3SalesExempt),
        box9PurchasesStandardAmount: String(computed.box9PurchasesStandardAmount),
        box9PurchasesStandardVat: String(computed.box9PurchasesStandardVat),
        totalOutputVat: String(computed.totalOutputVat),
        totalInputVat: String(computed.totalInputVat),
        netVatPayable: String(computed.netVatPayable),
        notes: notes || null,
      });
      const ret = await storage.createVatReturn(data);
      return res.json(ret);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/vat/returns/:id", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateVatReturn(req.params.id, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/vat/returns/:id/file", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const updated = await storage.updateVatReturn(req.params.id, {
        status: "filed",
        filedAt: new Date(),
        filedBy: user.id,
        ftaReference: req.body.ftaReference || null,
      } as any);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/vat/returns/:id/mark-paid", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateVatReturn(req.params.id, { status: "paid" } as any);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/vat/returns/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteVatReturn(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ============ CORPORATE TAX RETURNS ============
  app.get("/api/ct/returns", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const rows = await storage.getCorporateTaxReturnsByTenant(user.tenantId);
    return res.json(rows);
  });

  app.get("/api/ct/returns/:id", authMiddleware, async (req: Request, res: Response) => {
    const ret = await storage.getCorporateTaxReturn(req.params.id);
    if (!ret) return res.status(404).json({ message: "Not found" });
    return res.json(ret);
  });

  app.post("/api/ct/compute", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { fyStart, fyEnd } = req.body;
      if (!fyStart || !fyEnd) return res.status(400).json({ message: "fyStart and fyEnd required" });
      const computed = await storage.computeCorporateTaxReturn(user.tenantId, fyStart, fyEnd);
      return res.json(computed);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ct/returns", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { fyStart, fyEnd, dueDate, addBacks = 0, exemptIncome = 0, reliefClaimed = 0, smallBusinessRelief = false, notes } = req.body;
      if (!fyStart || !fyEnd) return res.status(400).json({ message: "fyStart and fyEnd required" });
      const computed = await storage.computeCorporateTaxReturn(user.tenantId, fyStart, fyEnd);
      const accountingProfit = computed.accountingProfit + Number(addBacks) - Number(exemptIncome);
      const taxableIncome = Math.max(0, accountingProfit - Number(reliefClaimed));
      const threshold = 375000;
      let taxDue = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;
      if (smallBusinessRelief && computed.totalRevenue <= 3000000) taxDue = 0;
      const data = insertCorporateTaxReturnSchema.parse({
        tenantId: user.tenantId,
        fyStart,
        fyEnd,
        dueDate: dueDate || null,
        status: "draft",
        totalRevenue: String(computed.totalRevenue),
        totalExpenses: String(computed.totalExpenses),
        accountingProfit: String(accountingProfit),
        addBacks: String(addBacks),
        exemptIncome: String(exemptIncome),
        reliefClaimed: String(reliefClaimed),
        smallBusinessRelief: !!smallBusinessRelief,
        taxableIncome: String(taxableIncome),
        threshold: String(threshold),
        taxRate: "9",
        taxDue: String(Math.round(taxDue * 100) / 100),
        notes: notes || null,
      });
      const ret = await storage.createCorporateTaxReturn(data);
      return res.json(ret);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ct/returns/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateCorporateTaxReturn(req.params.id, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ct/returns/:id/file", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const updated = await storage.updateCorporateTaxReturn(req.params.id, {
        status: "filed",
        filedAt: new Date(),
        filedBy: user.id,
        ftaReference: req.body.ftaReference || null,
      } as any);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ct/returns/:id/mark-paid", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateCorporateTaxReturn(req.params.id, { status: "paid" } as any);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/ct/returns/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteCorporateTaxReturn(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Fixed Assets ───────────────────────────────────────
  app.get("/api/fixed-assets", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getFixedAssetsByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/fixed-assets", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const data = insertFixedAssetSchema.parse({ ...req.body, tenantId: user.tenantId });
      const asset = await storage.createFixedAsset(data);
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "asset_added",
        description: `Fixed asset "${data.name}" was added`,
      });
      return res.json(asset);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/fixed-assets/:id", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateFixedAsset(req.params.id, req.body);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/fixed-assets/:id", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      await storage.deleteFixedAsset(req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Membership Transfers ───────────────────────────────
  app.get("/api/membership-transfers", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.json([]);
    const list = await storage.getMembershipTransfersByTenant(user.tenantId);
    return res.json(list);
  });

  app.post("/api/membership-transfers", authMiddleware, requireRole("gym_owner", "manager", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const data = insertMembershipTransferSchema.parse({ ...req.body, tenantId: user.tenantId });

      const fromMember = await storage.getMember(data.fromMemberId);
      const toMember = await storage.getMember(data.toMemberId);
      if (!fromMember || fromMember.tenantId !== user.tenantId) return res.status(404).json({ message: "Source member not found" });
      if (!toMember || toMember.tenantId !== user.tenantId) return res.status(404).json({ message: "Destination member not found" });
      if (data.fromMemberId === data.toMemberId) return res.status(400).json({ message: "Source and destination must be different" });

      let remainingDays: number | undefined;
      if (fromMember.membershipEnd) {
        const ms = new Date(fromMember.membershipEnd).getTime() - Date.now();
        remainingDays = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      }

      const transfer = await storage.createMembershipTransfer({
        ...data,
        membershipPlanId: data.membershipPlanId || fromMember.membershipPlanId || undefined,
        remainingDays: data.remainingDays ?? remainingDays,
      } as any);

      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "transfer_requested",
        description: `Transfer requested: ${fromMember.firstName} ${fromMember.lastName} → ${toMember.firstName} ${toMember.lastName}`,
      });
      return res.json(transfer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/membership-transfers/:id/approve", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const result = await storage.executeMembershipTransfer(req.params.id, user.id);
      if (!result) return res.status(404).json({ message: "Transfer not found" });
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/membership-transfers/:id/reject", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const updated = await storage.updateMembershipTransfer(req.params.id, {
        status: "rejected",
        approvedBy: user.id,
      } as any);
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Dashboard: Today's Sales & Alerts ─────────────────
  app.get("/api/dashboard/sales-today", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const stats = await storage.getSalesToday(user.tenantId);
    return res.json(stats);
  });

  app.get("/api/dashboard/alerts", authMiddleware, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
    const alerts = await storage.getDashboardAlerts(user.tenantId);
    return res.json(alerts);
  });

  // ─── Stripe Settings (Platform Admin) ──────────────────
  app.get("/api/admin/stripe/status", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    try {
      const ready = isStripeReady();
      let mode: "test" | "live" | "unknown" = "unknown";
      let accountId: string | null = null;
      let displayName: string | null = null;
      let webhookUrl: string | null = null;
      if (ready) {
        try {
          const stripe = await getUncachableStripeClient();
          const acct: any = await stripe.accounts.retrieve();
          accountId = acct.id;
          displayName = acct.business_profile?.name || acct.settings?.dashboard?.display_name || acct.email;
          // Determine mode by inspecting publishable key
          const pk = await getStripePublishableKey();
          mode = pk.startsWith("pk_live_") ? "live" : "test";
          const baseUrl = process.env.REPLIT_DEPLOYMENT === "1"
            ? `https://${(process.env.REPLIT_DOMAINS || "").split(",")[0]}`
            : `https://${(process.env.REPLIT_DEV_DOMAIN || (process.env.REPLIT_DOMAINS || "").split(",")[0])}`;
          webhookUrl = `${baseUrl}/api/stripe/webhook`;
        } catch (e: any) {
          console.warn("[stripe] status retrieve error:", e.message);
        }
      }
      const allPlans = await storage.getAllPlans();
      const planSync = allPlans.map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        isActive: p.isActive,
        synced: !!(p.stripeProductId && p.stripeMonthlyPriceId && p.stripeAnnualPriceId),
        stripeProductId: p.stripeProductId,
      }));
      return res.json({ ready, mode, accountId, displayName, webhookUrl, planSync });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/stripe/sync-all", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    try {
      if (!isStripeReady()) return res.status(503).json({ message: "Stripe not initialized" });
      const plans = await storage.getAllPlans();
      const results: Array<{ id: string; name: string; ok: boolean; error?: string }> = [];
      for (const p of plans) {
        try {
          await syncPlanToStripe(p.id);
          results.push({ id: p.id, name: p.name, ok: true });
        } catch (e: any) {
          results.push({ id: p.id, name: p.name, ok: false, error: e.message });
        }
      }
      return res.json({ results });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ─── Admin Billing Overview ─────────────────────────────
  app.get("/api/admin/billing/tenants", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    try {
      const tenants = await storage.getAllTenants();
      const plans = await storage.getAllPlans();
      const planByName: Record<string, any> = {};
      plans.forEach((p) => (planByName[p.name.toLowerCase()] = p));
      const data = tenants.map((t) => {
        const plan = t.subscriptionPlan ? planByName[t.subscriptionPlan.toLowerCase()] : null;
        const monthlyRevenue = plan && t.subscriptionStatus === "active"
          ? (t.subscriptionInterval === "annual"
              ? Number(plan.priceAnnual) / 12
              : Number(plan.priceMonthly))
          : 0;
        return {
          id: t.id,
          gymName: t.gymName,
          email: t.email,
          subscriptionPlan: t.subscriptionPlan,
          subscriptionStatus: t.subscriptionStatus || "trialing",
          subscriptionInterval: t.subscriptionInterval || "monthly",
          currentPeriodEnd: t.currentPeriodEnd,
          gracePeriodEndsAt: t.gracePeriodEndsAt,
          cancelAtPeriodEnd: t.cancelAtPeriodEnd,
          stripeCustomerId: t.stripeCustomerId,
          stripeSubscriptionId: t.stripeSubscriptionId,
          isActive: t.isActive,
          monthlyRevenue,
        };
      });
      const mrr = data.reduce((s, t) => s + (t.monthlyRevenue || 0), 0);
      const counts = data.reduce(
        (acc, t) => {
          acc[t.subscriptionStatus] = (acc[t.subscriptionStatus] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      return res.json({ tenants: data, mrr, counts });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ─── Gym-Owner Billing ──────────────────────────────────
  app.get("/api/billing/me", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      const plans = await storage.getAllPlans();

      let upcomingInvoice: any = null;
      let invoices: any[] = [];
      let paymentMethod: any = null;

      if (isStripeReady() && tenant.stripeCustomerId) {
        try {
          const stripe = await getUncachableStripeClient();
          const customer: any = await stripe.customers.retrieve(tenant.stripeCustomerId, {
            expand: ["invoice_settings.default_payment_method"],
          });
          const pm = customer.invoice_settings?.default_payment_method;
          if (pm && typeof pm !== "string") {
            paymentMethod = {
              brand: pm.card?.brand,
              last4: pm.card?.last4,
              expMonth: pm.card?.exp_month,
              expYear: pm.card?.exp_year,
            };
          }
          const inv = await stripe.invoices.list({
            customer: tenant.stripeCustomerId,
            limit: 12,
          });
          invoices = inv.data.map((i: any) => ({
            id: i.id,
            number: i.number,
            amount: i.amount_paid || i.amount_due,
            currency: i.currency,
            status: i.status,
            created: i.created,
            periodStart: i.period_start,
            periodEnd: i.period_end,
            hostedInvoiceUrl: i.hosted_invoice_url,
            invoicePdf: i.invoice_pdf,
          }));
          if (tenant.stripeSubscriptionId) {
            try {
              const sub: any = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
              upcomingInvoice = {
                periodEnd: sub.current_period_end || sub.items?.data?.[0]?.current_period_end,
                amount: sub.items?.data?.[0]?.price?.unit_amount,
                currency: sub.items?.data?.[0]?.price?.currency,
              };
            } catch {}
          }
        } catch (e: any) {
          console.warn("[stripe] /billing/me retrieve error:", e.message);
        }
      }

      return res.json({
        tenant: {
          id: tenant.id,
          gymName: tenant.gymName,
          subscriptionPlan: tenant.subscriptionPlan,
          subscriptionStatus: tenant.subscriptionStatus || "trialing",
          subscriptionInterval: tenant.subscriptionInterval || "monthly",
          currentPeriodEnd: tenant.currentPeriodEnd,
          gracePeriodEndsAt: tenant.gracePeriodEndsAt,
          cancelAtPeriodEnd: tenant.cancelAtPeriodEnd,
          isActive: tenant.isActive,
          hasCustomer: !!tenant.stripeCustomerId,
          hasSubscription: !!tenant.stripeSubscriptionId,
        },
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          priceMonthly: p.priceMonthly,
          priceAnnual: p.priceAnnual,
          features: p.features,
          maxMembers: p.maxMembers,
          isPopular: p.isPopular,
          isActive: p.isActive,
          synced: !!(p.stripeMonthlyPriceId && p.stripeAnnualPriceId),
        })),
        paymentMethod,
        invoices,
        upcomingInvoice,
        stripeReady: isStripeReady(),
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/billing/checkout", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      if (!isStripeReady()) return res.status(503).json({ message: "Stripe not initialized" });
      const user = (req as any).user;
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const input = z.object({
        planId: z.string().min(1),
        interval: z.enum(["monthly", "annual"]).default("monthly"),
      }).parse(req.body);

      const plan = await storage.getPlan(input.planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const priceId = input.interval === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;
      if (!priceId) {
        return res.status(400).json({
          message: "This plan is not yet synced with Stripe. Ask your platform admin to sync it.",
        });
      }

      const stripe = await getUncachableStripeClient();

      // Reuse customer if exists, otherwise create
      let customerId = tenant.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: tenant.gymName,
          email: tenant.email || undefined,
          metadata: { tenantId: tenant.id },
        });
        customerId = customer.id;
        await storage.updateTenant(tenant.id, { stripeCustomerId: customerId });
      }

      const baseUrl = getTrustedBaseUrl();
      const successUrl = `${baseUrl}/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/settings/billing?status=canceled`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { tenantId: tenant.id, planId: plan.id, interval: input.interval },
        },
        metadata: { tenantId: tenant.id, planId: plan.id, interval: input.interval },
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/billing/portal", authMiddleware, requireRole("gym_owner", "platform_admin"), async (req: Request, res: Response) => {
    try {
      if (!isStripeReady()) return res.status(503).json({ message: "Stripe not initialized" });
      const user = (req as any).user;
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer; subscribe first." });
      }
      const stripe = await getUncachableStripeClient();
      const baseUrl = getTrustedBaseUrl();
      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${baseUrl}/settings/billing`,
      });
      return res.json({ url: session.url });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ─── Biometric Access Control (devices, templates, events, webhooks) ───
  registerBiometricRoutes(app, authMiddleware);

  return httpServer;
}
