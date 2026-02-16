import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  tenants, users, members, subscriptionPlans, activities,
  type Tenant, type InsertTenant,
  type User, type InsertUser,
  type Member, type InsertMember,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type Activity, type InsertActivity,
} from "@shared/schema";

export interface IStorage {
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;

  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getUsersByRole(tenantId: string, role: string): Promise<User[]>;

  getMembersByTenant(tenantId: string): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, data: Partial<InsertMember>): Promise<Member | undefined>;

  getAllPlans(): Promise<SubscriptionPlan[]>;
  createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;

  getActivities(tenantId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  getDashboardStats(tenantId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    expiringMembers: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    memberGrowth: number;
  }>;

  getAdminStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    mrr: number;
    mrrGrowth: number;
    totalMembers: number;
    churnRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.domain, domain));
    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  async getUsersByRole(tenantId: string, role: string): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, role)));
  }

  async getMembersByTenant(tenantId: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.tenantId, tenantId)).orderBy(desc(members.createdAt));
  }

  async getMember(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member;
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [created] = await db.insert(members).values(member).returning();
    return created;
  }

  async updateMember(id: string, data: Partial<InsertMember>): Promise<Member | undefined> {
    const [updated] = await db.update(members).set(data).where(eq(members.id, id)).returning();
    return updated;
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans);
  }

  async createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan).returning();
    return created;
  }

  async getActivities(tenantId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.tenantId, tenantId)).orderBy(desc(activities.createdAt)).limit(50);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async getDashboardStats(tenantId: string) {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allMembers = await db.select().from(members).where(eq(members.tenantId, tenantId));
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.status === "active").length;
    const expiringMembers = allMembers.filter(m => {
      if (!m.membershipEnd) return false;
      const end = new Date(m.membershipEnd);
      return end >= now && end <= sevenDaysLater && m.status === "active";
    }).length;

    return {
      totalMembers,
      activeMembers,
      expiringMembers,
      monthlyRevenue: activeMembers * 49,
      revenueGrowth: 8,
      memberGrowth: 12,
    };
  }

  async getAdminStats() {
    const allTenants = await db.select().from(tenants);
    const allMembers = await db.select().from(members);
    const totalTenants = allTenants.length;
    const activeTenants = allTenants.filter(t => t.isActive).length;

    const planPrices: Record<string, number> = { basic: 29, pro: 79, enterprise: 199 };
    const mrr = allTenants.reduce((sum, t) => sum + (planPrices[t.subscriptionPlan || "basic"] || 29), 0);

    return {
      totalTenants,
      activeTenants,
      mrr,
      mrrGrowth: 15,
      totalMembers: allMembers.length,
      churnRate: 2.5,
    };
  }
}

export const storage = new DatabaseStorage();
