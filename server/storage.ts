import { eq, and, desc, gte, lte, sql, between } from "drizzle-orm";
import { db } from "./db";
import {
  tenants, users, members, subscriptionPlans, activities,
  branches, attendance, trainerSessions, sessionBookings,
  equipment, suppliers, invoices, notifications, coupons, referrals,
  memberMetrics, equipmentMaintenance, paymentRecords,
  type Tenant, type InsertTenant,
  type User, type InsertUser,
  type Branch, type InsertBranch,
  type Member, type InsertMember,
  type Attendance, type InsertAttendance,
  type TrainerSession, type InsertTrainerSession,
  type SessionBooking, type InsertSessionBooking,
  type Equipment, type InsertEquipment,
  type Supplier, type InsertSupplier,
  type Invoice, type InsertInvoice,
  type Notification, type InsertNotification,
  type Coupon, type InsertCoupon,
  type Referral, type InsertReferral,
  type MemberMetric, type InsertMemberMetric,
  type EquipmentMaintenance, type InsertEquipmentMaintenance,
  type PaymentRecord, type InsertPaymentRecord,
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

  getBranchesByTenant(tenantId: string): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<void>;

  getMembersByTenant(tenantId: string): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, data: Partial<InsertMember>): Promise<Member | undefined>;

  getAttendanceByTenant(tenantId: string, date?: string): Promise<Attendance[]>;
  getAttendanceByMember(memberId: string): Promise<Attendance[]>;
  createAttendance(att: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, data: Partial<InsertAttendance>): Promise<Attendance | undefined>;

  getSessionsByTenant(tenantId: string, startDate?: Date, endDate?: Date): Promise<TrainerSession[]>;
  getSessionsByTrainer(trainerId: string): Promise<TrainerSession[]>;
  getSession(id: string): Promise<TrainerSession | undefined>;
  createSession(session: InsertTrainerSession): Promise<TrainerSession>;
  updateSession(id: string, data: Partial<InsertTrainerSession>): Promise<TrainerSession | undefined>;
  deleteSession(id: string): Promise<void>;
  getBookingsBySession(sessionId: string): Promise<SessionBooking[]>;
  createBooking(booking: InsertSessionBooking): Promise<SessionBooking>;

  getEquipmentByTenant(tenantId: string): Promise<Equipment[]>;
  getEquipment(id: string): Promise<Equipment | undefined>;
  createEquipment(item: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<void>;

  getSuppliersByTenant(tenantId: string): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;

  getInvoicesByTenant(tenantId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getNotificationsByTenant(tenantId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;

  getCouponsByTenant(tenantId: string): Promise<Coupon[]>;
  getCouponByCode(tenantId: string, code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;

  getReferralsByTenant(tenantId: string): Promise<Referral[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined>;

  getAllPlans(): Promise<SubscriptionPlan[]>;
  createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;

  getMetricsByMember(memberId: string): Promise<MemberMetric[]>;
  createMemberMetric(metric: InsertMemberMetric): Promise<MemberMetric>;

  getMaintenanceByTenant(tenantId: string): Promise<EquipmentMaintenance[]>;
  getMaintenanceByEquipment(equipmentId: string): Promise<EquipmentMaintenance[]>;
  createMaintenance(record: InsertEquipmentMaintenance): Promise<EquipmentMaintenance>;
  updateMaintenance(id: string, data: Partial<InsertEquipmentMaintenance>): Promise<EquipmentMaintenance | undefined>;

  getPaymentsByTenant(tenantId: string): Promise<PaymentRecord[]>;
  getPaymentsByMember(memberId: string): Promise<PaymentRecord[]>;
  createPayment(payment: InsertPaymentRecord): Promise<PaymentRecord>;
  updatePayment(id: string, data: Partial<InsertPaymentRecord>): Promise<PaymentRecord | undefined>;

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

  async getBranchesByTenant(tenantId: string): Promise<Branch[]> {
    return db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(desc(branches.createdAt));
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch;
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const [created] = await db.insert(branches).values(branch).returning();
    return created;
  }

  async updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined> {
    const [updated] = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
    return updated;
  }

  async deleteBranch(id: string): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
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

  async getAttendanceByTenant(tenantId: string, date?: string): Promise<Attendance[]> {
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return db.select().from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), between(attendance.checkInTime, start, end)))
        .orderBy(desc(attendance.checkInTime));
    }
    return db.select().from(attendance)
      .where(eq(attendance.tenantId, tenantId))
      .orderBy(desc(attendance.checkInTime))
      .limit(100);
  }

  async getAttendanceByMember(memberId: string): Promise<Attendance[]> {
    return db.select().from(attendance)
      .where(eq(attendance.memberId, memberId))
      .orderBy(desc(attendance.checkInTime))
      .limit(50);
  }

  async createAttendance(att: InsertAttendance): Promise<Attendance> {
    const [created] = await db.insert(attendance).values(att).returning();
    return created;
  }

  async updateAttendance(id: string, data: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const [updated] = await db.update(attendance).set(data).where(eq(attendance.id, id)).returning();
    return updated;
  }

  async getSessionsByTenant(tenantId: string, startDate?: Date, endDate?: Date): Promise<TrainerSession[]> {
    if (startDate && endDate) {
      return db.select().from(trainerSessions)
        .where(and(
          eq(trainerSessions.tenantId, tenantId),
          gte(trainerSessions.startTime, startDate),
          lte(trainerSessions.endTime, endDate)
        ))
        .orderBy(trainerSessions.startTime);
    }
    return db.select().from(trainerSessions)
      .where(eq(trainerSessions.tenantId, tenantId))
      .orderBy(trainerSessions.startTime);
  }

  async getSessionsByTrainer(trainerId: string): Promise<TrainerSession[]> {
    return db.select().from(trainerSessions)
      .where(eq(trainerSessions.trainerId, trainerId))
      .orderBy(trainerSessions.startTime);
  }

  async getSession(id: string): Promise<TrainerSession | undefined> {
    const [session] = await db.select().from(trainerSessions).where(eq(trainerSessions.id, id));
    return session;
  }

  async createSession(session: InsertTrainerSession): Promise<TrainerSession> {
    const [created] = await db.insert(trainerSessions).values(session).returning();
    return created;
  }

  async updateSession(id: string, data: Partial<InsertTrainerSession>): Promise<TrainerSession | undefined> {
    const [updated] = await db.update(trainerSessions).set(data).where(eq(trainerSessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessionBookings).where(eq(sessionBookings.sessionId, id));
    await db.delete(trainerSessions).where(eq(trainerSessions.id, id));
  }

  async getBookingsBySession(sessionId: string): Promise<SessionBooking[]> {
    return db.select().from(sessionBookings).where(eq(sessionBookings.sessionId, sessionId));
  }

  async createBooking(booking: InsertSessionBooking): Promise<SessionBooking> {
    const [created] = await db.insert(sessionBookings).values(booking).returning();
    await db.update(trainerSessions)
      .set({ enrolled: sql`${trainerSessions.enrolled} + 1` })
      .where(eq(trainerSessions.id, booking.sessionId));
    return created;
  }

  async getEquipmentByTenant(tenantId: string): Promise<Equipment[]> {
    return db.select().from(equipment).where(eq(equipment.tenantId, tenantId)).orderBy(desc(equipment.createdAt));
  }

  async getEquipment(id: string): Promise<Equipment | undefined> {
    const [item] = await db.select().from(equipment).where(eq(equipment.id, id));
    return item;
  }

  async createEquipment(item: InsertEquipment): Promise<Equipment> {
    const [created] = await db.insert(equipment).values(item).returning();
    return created;
  }

  async updateEquipment(id: string, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [updated] = await db.update(equipment).set(data).where(eq(equipment.id, id)).returning();
    return updated;
  }

  async deleteEquipment(id: string): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async getSuppliersByTenant(tenantId: string): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.tenantId, tenantId)).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async getInvoicesByTenant(tenantId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice as any).returning();
    return created;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set(data as any).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getNotificationsByTenant(tenantId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.tenantId, tenantId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async getCouponsByTenant(tenantId: string): Promise<Coupon[]> {
    return db.select().from(coupons).where(eq(coupons.tenantId, tenantId)).orderBy(desc(coupons.createdAt));
  }

  async getCouponByCode(tenantId: string, code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons)
      .where(and(eq(coupons.tenantId, tenantId), eq(coupons.code, code)));
    return coupon;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values(coupon).returning();
    return created;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
    return updated;
  }

  async getReferralsByTenant(tenantId: string): Promise<Referral[]> {
    return db.select().from(referrals).where(eq(referrals.tenantId, tenantId)).orderBy(desc(referrals.createdAt));
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [created] = await db.insert(referrals).values(referral).returning();
    return created;
  }

  async updateReferral(id: string, data: Partial<InsertReferral>): Promise<Referral | undefined> {
    const [updated] = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
    return updated;
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans);
  }

  async createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan as any).returning();
    return created;
  }

  async getActivities(tenantId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.tenantId, tenantId)).orderBy(desc(activities.createdAt)).limit(50);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async getMetricsByMember(memberId: string): Promise<MemberMetric[]> {
    return db.select().from(memberMetrics)
      .where(eq(memberMetrics.memberId, memberId))
      .orderBy(desc(memberMetrics.recordedAt));
  }

  async createMemberMetric(metric: InsertMemberMetric): Promise<MemberMetric> {
    const [created] = await db.insert(memberMetrics).values(metric).returning();
    return created;
  }

  async getMaintenanceByTenant(tenantId: string): Promise<EquipmentMaintenance[]> {
    return db.select().from(equipmentMaintenance)
      .where(eq(equipmentMaintenance.tenantId, tenantId))
      .orderBy(desc(equipmentMaintenance.scheduledDate));
  }

  async getMaintenanceByEquipment(equipmentId: string): Promise<EquipmentMaintenance[]> {
    return db.select().from(equipmentMaintenance)
      .where(eq(equipmentMaintenance.equipmentId, equipmentId))
      .orderBy(desc(equipmentMaintenance.scheduledDate));
  }

  async createMaintenance(record: InsertEquipmentMaintenance): Promise<EquipmentMaintenance> {
    const [created] = await db.insert(equipmentMaintenance).values(record).returning();
    return created;
  }

  async updateMaintenance(id: string, data: Partial<InsertEquipmentMaintenance>): Promise<EquipmentMaintenance | undefined> {
    const [updated] = await db.update(equipmentMaintenance).set(data).where(eq(equipmentMaintenance.id, id)).returning();
    return updated;
  }

  async getPaymentsByTenant(tenantId: string): Promise<PaymentRecord[]> {
    return db.select().from(paymentRecords)
      .where(eq(paymentRecords.tenantId, tenantId))
      .orderBy(desc(paymentRecords.createdAt));
  }

  async getPaymentsByMember(memberId: string): Promise<PaymentRecord[]> {
    return db.select().from(paymentRecords)
      .where(eq(paymentRecords.memberId, memberId))
      .orderBy(desc(paymentRecords.createdAt));
  }

  async createPayment(payment: InsertPaymentRecord): Promise<PaymentRecord> {
    const [created] = await db.insert(paymentRecords).values(payment).returning();
    return created;
  }

  async updatePayment(id: string, data: Partial<InsertPaymentRecord>): Promise<PaymentRecord | undefined> {
    const [updated] = await db.update(paymentRecords).set(data).where(eq(paymentRecords.id, id)).returning();
    return updated;
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

    const allEquip = await db.select().from(equipment).where(eq(equipment.tenantId, tenantId));
    const lowStockItems = allEquip.filter(e => (e.quantity || 0) <= (e.minStock || 5)).length;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayAttendance = await db.select().from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), between(attendance.checkInTime, todayStart, todayEnd)));

    return {
      totalMembers,
      activeMembers,
      expiringMembers,
      monthlyRevenue: activeMembers * 49,
      revenueGrowth: 8,
      memberGrowth: 12,
      lowStockItems,
      todayCheckIns: todayAttendance.length,
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
