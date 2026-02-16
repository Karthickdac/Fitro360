import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { loginSchema } from "@shared/schema";
import { z } from "zod";

const SESSION_SECRET = process.env.SESSION_SECRET || "fitro360-dev-secret";

function paramId(req: Request): string {
  return req.params.id as string;
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
        maxAge: 7 * 24 * 60 * 60 * 1000,
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
      const tenant = await storage.getTenantByDomain(domain);
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
      return res.json({ gymName: "ForgeFit", primaryColor: "#1e40af", secondaryColor: "#3b82f6" });
    } catch {
      return res.json({ gymName: "ForgeFit", primaryColor: "#1e40af", secondaryColor: "#3b82f6" });
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
        membershipType: z.string().min(1),
        status: z.string().optional(),
        heightCm: z.string().optional(),
        weightKg: z.string().optional(),
        branchId: z.string().optional(),
      }).parse(req.body);

      const now = new Date();
      let membershipEnd: Date;
      switch (memberInput.membershipType) {
        case "annual": membershipEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); break;
        case "quarterly": membershipEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); break;
        case "day_pass": membershipEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
        default: membershipEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      let bmi: string | undefined;
      if (memberInput.heightCm && memberInput.weightKg) {
        const h = parseFloat(memberInput.heightCm) / 100;
        const w = parseFloat(memberInput.weightKg);
        if (h > 0) bmi = (w / (h * h)).toFixed(1);
      }

      const member = await storage.createMember({
        ...memberInput,
        tenantId: user.tenantId,
        membershipStart: now,
        membershipEnd,
        status: "active",
        bmi,
      });

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

      const data = req.body;
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
    const safeTrainers = trainerList.map(({ password: _, ...rest }) => rest);
    return res.json(safeTrainers);
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
        trnNumber: z.string().optional(),
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
      const gstRate = parseFloat(input.gstRate || "5");
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
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "payment",
        description: `Payment of ${input.currency || "AED"} ${input.amount} received via ${input.method}`,
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
      const { amount, currency, description, memberId, invoiceId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: currency || "aed",
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
      const { gymName, email, domain, subscriptionPlan, primaryColor, secondaryColor, ownerFirstName, ownerLastName, ownerUsername, ownerPassword } = req.body;
      const existingUser = await storage.getUserByUsername(ownerUsername);
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
      const tenant = await storage.createTenant({
        gymName, email,
        domain: domain || null,
        subscriptionPlan, primaryColor, secondaryColor,
        appDisplayName: gymName,
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

  app.get("/api/admin/plans", authMiddleware, requireRole("platform_admin"), async (_req: Request, res: Response) => {
    const plans = await storage.getAllPlans();
    return res.json(plans);
  });

  return httpServer;
}
