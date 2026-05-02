import { eq, and, desc, gte, lte, sql, between } from "drizzle-orm";
import { db } from "./db";
import { encryptString, decryptString, encryptJson, decryptJson } from "./biometric/crypto";
import {
  tenants, users, members, subscriptionPlans, processedStripeEvents, activities,
  branches, attendance, trainerSessions, sessionBookings,
  equipment, suppliers, invoices, notifications, coupons, referrals,
  memberMetrics, equipmentMaintenance, paymentRecords,
  trainerCommissions, trainerLeaves, trainerProfiles, membershipPlans,
  supplierBills, vatReturns, corporateTaxReturns, fixedAssets, membershipTransfers,
  devices, biometricTemplates, accessEvents, doorCommands, processedBiometricEvents,
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
  type MembershipPlan, type InsertMembershipPlan,
  type Activity, type InsertActivity,
  type TrainerCommission, type InsertTrainerCommission,
  type TrainerLeave, type InsertTrainerLeave,
  type TrainerProfile, type InsertTrainerProfile,
  type SupplierBill, type InsertSupplierBill,
  type VatReturn, type InsertVatReturn,
  type CorporateTaxReturn, type InsertCorporateTaxReturn,
  type FixedAsset, type InsertFixedAsset,
  type MembershipTransfer, type InsertMembershipTransfer,
  type Device, type InsertDevice,
  type BiometricTemplate, type InsertBiometricTemplate,
  type AccessEvent, type InsertAccessEvent,
  type DoorCommand, type InsertDoorCommand,
} from "@shared/schema";

export interface IStorage {
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  getTenantByStripeCustomerId(customerId: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<void>;
  getTenantUserCount(tenantId: string): Promise<number>;
  getTenantMemberCount(tenantId: string): Promise<number>;
  getTenantsWithExpiredGrace(now: Date): Promise<Tenant[]>;
  getPlanByStripePriceId(priceId: string): Promise<SubscriptionPlan | undefined>;
  isStripeEventProcessed(eventId: string): Promise<boolean>;
  markStripeEventProcessed(eventId: string, type: string): Promise<void>;

  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getUsersByRole(tenantId: string, role: string): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getTrainerProfile(userId: string): Promise<TrainerProfile | undefined>;
  getTrainerProfilesByTenant(tenantId: string): Promise<TrainerProfile[]>;
  createTrainerProfile(profile: InsertTrainerProfile): Promise<TrainerProfile>;
  updateTrainerProfile(userId: string, data: Partial<InsertTrainerProfile>): Promise<TrainerProfile | undefined>;

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
  getBookingsByMember(memberId: string): Promise<SessionBooking[]>;
  createBooking(booking: InsertSessionBooking): Promise<SessionBooking>;
  cancelBooking(bookingId: string): Promise<void>;
  getMemberByEmail(tenantId: string, email: string): Promise<Member | undefined>;

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

  getMembershipPlansByTenant(tenantId: string): Promise<MembershipPlan[]>;
  getMembershipPlan(id: string): Promise<MembershipPlan | undefined>;
  createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;
  updateMembershipPlan(id: string, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined>;
  deleteMembershipPlan(id: string): Promise<void>;

  getAllPlans(): Promise<SubscriptionPlan[]>;
  getPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updatePlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deletePlan(id: string): Promise<void>;

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

  getCommissionsByTenant(tenantId: string): Promise<TrainerCommission[]>;
  getCommissionsByTrainer(trainerId: string): Promise<TrainerCommission[]>;
  createCommission(commission: InsertTrainerCommission): Promise<TrainerCommission>;
  updateCommission(id: string, data: Partial<InsertTrainerCommission>): Promise<TrainerCommission | undefined>;

  getLeavesByTenant(tenantId: string): Promise<TrainerLeave[]>;
  getLeavesByTrainer(trainerId: string): Promise<TrainerLeave[]>;
  createLeave(leave: InsertTrainerLeave): Promise<TrainerLeave>;
  updateLeave(id: string, data: Partial<InsertTrainerLeave>): Promise<TrainerLeave | undefined>;

  getActivities(tenantId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  getSupplierBillsByTenant(tenantId: string): Promise<SupplierBill[]>;
  getSupplierBill(id: string): Promise<SupplierBill | undefined>;
  createSupplierBill(bill: InsertSupplierBill): Promise<SupplierBill>;
  updateSupplierBill(id: string, data: Partial<InsertSupplierBill>): Promise<SupplierBill | undefined>;
  deleteSupplierBill(id: string): Promise<void>;

  getVatReturnsByTenant(tenantId: string): Promise<VatReturn[]>;
  getVatReturn(id: string): Promise<VatReturn | undefined>;
  createVatReturn(ret: InsertVatReturn): Promise<VatReturn>;
  updateVatReturn(id: string, data: Partial<InsertVatReturn>): Promise<VatReturn | undefined>;
  deleteVatReturn(id: string): Promise<void>;
  computeVatReturn(tenantId: string, periodStart: string, periodEnd: string): Promise<{
    box1aSalesStandardAmount: number;
    box1aSalesStandardVat: number;
    box2SalesZero: number;
    box3SalesExempt: number;
    box9PurchasesStandardAmount: number;
    box9PurchasesStandardVat: number;
    totalOutputVat: number;
    totalInputVat: number;
    netVatPayable: number;
  }>;

  getCorporateTaxReturnsByTenant(tenantId: string): Promise<CorporateTaxReturn[]>;
  getCorporateTaxReturn(id: string): Promise<CorporateTaxReturn | undefined>;
  createCorporateTaxReturn(ret: InsertCorporateTaxReturn): Promise<CorporateTaxReturn>;
  updateCorporateTaxReturn(id: string, data: Partial<InsertCorporateTaxReturn>): Promise<CorporateTaxReturn | undefined>;
  deleteCorporateTaxReturn(id: string): Promise<void>;
  computeCorporateTaxReturn(tenantId: string, fyStart: string, fyEnd: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    accountingProfit: number;
    taxableIncome: number;
    taxDue: number;
  }>;

  getFixedAssetsByTenant(tenantId: string): Promise<FixedAsset[]>;
  getFixedAsset(id: string): Promise<FixedAsset | undefined>;
  createFixedAsset(asset: InsertFixedAsset): Promise<FixedAsset>;
  updateFixedAsset(id: string, data: Partial<InsertFixedAsset>): Promise<FixedAsset | undefined>;
  deleteFixedAsset(id: string): Promise<void>;

  getMembershipTransfersByTenant(tenantId: string): Promise<MembershipTransfer[]>;
  getMembershipTransfer(id: string): Promise<MembershipTransfer | undefined>;
  createMembershipTransfer(transfer: InsertMembershipTransfer): Promise<MembershipTransfer>;
  updateMembershipTransfer(id: string, data: Partial<InsertMembershipTransfer>): Promise<MembershipTransfer | undefined>;
  executeMembershipTransfer(id: string, approvedBy: string): Promise<MembershipTransfer | undefined>;

  // Biometric access control
  getDevicesByTenant(tenantId: string): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceBySerial(serialNumber: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice> & { lastSeenAt?: Date | null; lastError?: string | null }): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  getTemplatesByMember(memberId: string): Promise<BiometricTemplate[]>;
  getTemplatesByTenant(tenantId: string): Promise<BiometricTemplate[]>;
  getTemplate(id: string): Promise<BiometricTemplate | undefined>;
  getTemplateByExternalRef(deviceId: string, externalRef: string): Promise<BiometricTemplate | undefined>;
  createTemplate(template: InsertBiometricTemplate): Promise<BiometricTemplate>;
  updateTemplate(id: string, data: Partial<InsertBiometricTemplate>): Promise<BiometricTemplate | undefined>;
  deleteTemplate(id: string): Promise<void>;
  deleteTemplatesByMember(memberId: string): Promise<void>;

  getAccessEventsByTenant(tenantId: string, opts?: { branchId?: string; deviceId?: string; memberId?: string; decision?: string; limit?: number }): Promise<AccessEvent[]>;
  getAccessEventsByMember(memberId: string, limit?: number): Promise<AccessEvent[]>;
  createAccessEvent(event: InsertAccessEvent): Promise<AccessEvent>;

  isBiometricEventProcessed(id: string): Promise<boolean>;
  markBiometricEventProcessed(id: string, deviceId: string): Promise<void>;
  claimBiometricEvent(id: string, deviceId: string): Promise<boolean>;

  getDoorCommand(id: string): Promise<DoorCommand | undefined>;
  getPendingDoorCommands(deviceId: string): Promise<DoorCommand[]>;
  getDoorCommandByIdempotencyKey(key: string): Promise<DoorCommand | undefined>;
  createDoorCommand(cmd: InsertDoorCommand): Promise<DoorCommand>;
  markDoorCommandPickedUp(id: string): Promise<void>;
  markDoorCommandComplete(id: string, status: "done" | "failed", error?: string): Promise<void>;

  getSalesToday(tenantId: string): Promise<{
    perDayTotal: number;
    cashTotal: number;
    creditTotal: number;
    perDayCount: number;
    cashCount: number;
    creditCount: number;
  }>;
  getDashboardAlerts(tenantId: string): Promise<{
    birthdaysToday: { id: string; firstName: string; lastName: string; dateOfBirth: string | null }[];
    expiringSoon: { id: string; firstName: string; lastName: string; membershipEnd: string | null; daysLeft: number }[];
    ptSessionsToday: { id: string; title: string; startTime: string; endTime: string; trainerId: string }[];
  }>;

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

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));
    return tenant;
  }

  async getTenantByStripeCustomerId(customerId: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.stripeCustomerId, customerId));
    return tenant;
  }

  async getTenantsWithExpiredGrace(now: Date): Promise<Tenant[]> {
    return db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.isActive, true),
          lte(tenants.gracePeriodEndsAt, now),
          sql`${tenants.subscriptionStatus} IN ('past_due','unpaid','incomplete_expired')`,
        ),
      );
  }

  async getPlanByStripePriceId(priceId: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        sql`${subscriptionPlans.stripeMonthlyPriceId} = ${priceId} OR ${subscriptionPlans.stripeAnnualPriceId} = ${priceId}`,
      );
    return plan;
  }

  async isStripeEventProcessed(eventId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: processedStripeEvents.id })
      .from(processedStripeEvents)
      .where(eq(processedStripeEvents.id, eventId));
    return !!row;
  }

  async markStripeEventProcessed(eventId: string, type: string): Promise<void> {
    await db
      .insert(processedStripeEvents)
      .values({ id: eventId, type })
      .onConflictDoNothing();
  }

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getTenant(id);
    const [updated] = await db.update(tenants).set(data as any).where(eq(tenants.id, id)).returning();
    return updated;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(users).where(eq(users.tenantId, id));
    await db.delete(members).where(eq(members.tenantId, id));
    await db.delete(branches).where(eq(branches.tenantId, id));
    await db.delete(activities).where(eq(activities.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getTenantUserCount(tenantId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.tenantId, tenantId));
    return Number(result[0]?.count || 0);
  }

  async getTenantMemberCount(tenantId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(members).where(eq(members.tenantId, tenantId));
    return Number(result[0]?.count || 0);
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

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getUser(id);
    const [updated] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return updated;
  }

  async getTrainerProfile(userId: string): Promise<TrainerProfile | undefined> {
    const [profile] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.userId, userId));
    return profile;
  }

  async getTrainerProfilesByTenant(tenantId: string): Promise<TrainerProfile[]> {
    return db.select().from(trainerProfiles).where(eq(trainerProfiles.tenantId, tenantId));
  }

  async createTrainerProfile(profile: InsertTrainerProfile): Promise<TrainerProfile> {
    const [created] = await db.insert(trainerProfiles).values(profile as any).returning();
    return created;
  }

  async updateTrainerProfile(userId: string, data: Partial<InsertTrainerProfile>): Promise<TrainerProfile | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getTrainerProfile(userId) ?? undefined;
    const [updated] = await db.update(trainerProfiles).set(data as any).where(eq(trainerProfiles.userId, userId)).returning();
    return updated;
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
    if (!data || Object.keys(data).length === 0) return this.getBranch(id);
    const [updated] = await db.update(branches).set(data as any).where(eq(branches.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return this.getMember(id);
    const [updated] = await db.update(members).set(data as any).where(eq(members.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(attendance).set(data as any).where(eq(attendance.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return this.getSession(id);
    const [updated] = await db.update(trainerSessions).set(data as any).where(eq(trainerSessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessionBookings).where(eq(sessionBookings.sessionId, id));
    await db.delete(trainerSessions).where(eq(trainerSessions.id, id));
  }

  async getBookingsBySession(sessionId: string): Promise<SessionBooking[]> {
    return db.select().from(sessionBookings).where(eq(sessionBookings.sessionId, sessionId));
  }

  async getBookingsByMember(memberId: string): Promise<SessionBooking[]> {
    return db.select().from(sessionBookings).where(eq(sessionBookings.memberId, memberId));
  }

  async createBooking(booking: InsertSessionBooking): Promise<SessionBooking> {
    const [created] = await db.insert(sessionBookings).values(booking).returning();
    await db.update(trainerSessions)
      .set({ enrolled: sql`${trainerSessions.enrolled} + 1` })
      .where(eq(trainerSessions.id, booking.sessionId));
    return created;
  }

  async cancelBooking(bookingId: string): Promise<void> {
    const [booking] = await db.select().from(sessionBookings).where(eq(sessionBookings.id, bookingId));
    if (booking) {
      await db.delete(sessionBookings).where(eq(sessionBookings.id, bookingId));
      await db.update(trainerSessions)
        .set({ enrolled: sql`GREATEST(${trainerSessions.enrolled} - 1, 0)` })
        .where(eq(trainerSessions.id, booking.sessionId));
    }
  }

  async getMemberByEmail(tenantId: string, email: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(and(eq(members.tenantId, tenantId), eq(members.email, email)));
    return member;
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(equipment).set(data as any).where(eq(equipment.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(suppliers).set(data as any).where(eq(suppliers.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(coupons).set(data as any).where(eq(coupons.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(referrals).set(data as any).where(eq(referrals.id, id)).returning();
    return updated;
  }

  async getMembershipPlansByTenant(tenantId: string): Promise<MembershipPlan[]> {
    return db.select().from(membershipPlans).where(eq(membershipPlans.tenantId, tenantId)).orderBy(membershipPlans.sortOrder);
  }

  async getMembershipPlan(id: string): Promise<MembershipPlan | undefined> {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
    return plan;
  }

  async createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan> {
    const [created] = await db.insert(membershipPlans).values(plan as any).returning();
    return created;
  }

  async updateMembershipPlan(id: string, data: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined> {
    const [updated] = await db.update(membershipPlans).set(data as any).where(eq(membershipPlans.id, id)).returning();
    return updated;
  }

  async deleteMembershipPlan(id: string): Promise<void> {
    await db.update(membershipPlans).set({ isActive: false }).where(eq(membershipPlans.id, id));
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans);
  }

  async getPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan as any).returning();
    return created;
  }

  async updatePlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set(data as any).where(eq(subscriptionPlans.id, id)).returning();
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(equipmentMaintenance).set(data as any).where(eq(equipmentMaintenance.id, id)).returning();
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
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(paymentRecords).set(data as any).where(eq(paymentRecords.id, id)).returning();
    return updated;
  }

  async getCommissionsByTenant(tenantId: string): Promise<TrainerCommission[]> {
    return db.select().from(trainerCommissions).where(eq(trainerCommissions.tenantId, tenantId)).orderBy(desc(trainerCommissions.createdAt));
  }

  async getCommissionsByTrainer(trainerId: string): Promise<TrainerCommission[]> {
    return db.select().from(trainerCommissions).where(eq(trainerCommissions.trainerId, trainerId)).orderBy(desc(trainerCommissions.createdAt));
  }

  async createCommission(commission: InsertTrainerCommission): Promise<TrainerCommission> {
    const [created] = await db.insert(trainerCommissions).values(commission).returning();
    return created;
  }

  async updateCommission(id: string, data: Partial<InsertTrainerCommission>): Promise<TrainerCommission | undefined> {
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(trainerCommissions).set(data as any).where(eq(trainerCommissions.id, id)).returning();
    return updated;
  }

  async getLeavesByTenant(tenantId: string): Promise<TrainerLeave[]> {
    return db.select().from(trainerLeaves).where(eq(trainerLeaves.tenantId, tenantId)).orderBy(desc(trainerLeaves.createdAt));
  }

  async getLeavesByTrainer(trainerId: string): Promise<TrainerLeave[]> {
    return db.select().from(trainerLeaves).where(eq(trainerLeaves.trainerId, trainerId)).orderBy(desc(trainerLeaves.createdAt));
  }

  async createLeave(leave: InsertTrainerLeave): Promise<TrainerLeave> {
    const [created] = await db.insert(trainerLeaves).values(leave).returning();
    return created;
  }

  async updateLeave(id: string, data: Partial<InsertTrainerLeave>): Promise<TrainerLeave | undefined> {
    if (!data || Object.keys(data).length === 0) return undefined;
    const [updated] = await db.update(trainerLeaves).set(data as any).where(eq(trainerLeaves.id, id)).returning();
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

  async getSupplierBillsByTenant(tenantId: string): Promise<SupplierBill[]> {
    return db.select().from(supplierBills).where(eq(supplierBills.tenantId, tenantId)).orderBy(desc(supplierBills.billDate));
  }

  async getSupplierBill(id: string): Promise<SupplierBill | undefined> {
    const [bill] = await db.select().from(supplierBills).where(eq(supplierBills.id, id));
    return bill;
  }

  async createSupplierBill(bill: InsertSupplierBill): Promise<SupplierBill> {
    const [created] = await db.insert(supplierBills).values(bill as any).returning();
    return created;
  }

  async updateSupplierBill(id: string, data: Partial<InsertSupplierBill>): Promise<SupplierBill | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getSupplierBill(id);
    const [updated] = await db.update(supplierBills).set(data as any).where(eq(supplierBills.id, id)).returning();
    return updated;
  }

  async deleteSupplierBill(id: string): Promise<void> {
    await db.delete(supplierBills).where(eq(supplierBills.id, id));
  }

  async getVatReturnsByTenant(tenantId: string): Promise<VatReturn[]> {
    return db.select().from(vatReturns).where(eq(vatReturns.tenantId, tenantId)).orderBy(desc(vatReturns.periodStart));
  }

  async getVatReturn(id: string): Promise<VatReturn | undefined> {
    const [ret] = await db.select().from(vatReturns).where(eq(vatReturns.id, id));
    return ret;
  }

  async createVatReturn(ret: InsertVatReturn): Promise<VatReturn> {
    const [created] = await db.insert(vatReturns).values(ret as any).returning();
    return created;
  }

  async updateVatReturn(id: string, data: Partial<InsertVatReturn>): Promise<VatReturn | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getVatReturn(id);
    const [updated] = await db.update(vatReturns).set(data as any).where(eq(vatReturns.id, id)).returning();
    return updated;
  }

  async deleteVatReturn(id: string): Promise<void> {
    await db.delete(vatReturns).where(eq(vatReturns.id, id));
  }

  async computeVatReturn(tenantId: string, periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    const allInvoices = await db.select().from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), between(invoices.createdAt, start, end)));

    let box1aSalesStandardAmount = 0;
    let box1aSalesStandardVat = 0;
    let box2SalesZero = 0;
    let box3SalesExempt = 0;

    for (const inv of allInvoices) {
      const subtotal = Number(inv.subtotal || 0);
      const vatAmount = Number(inv.gstAmount || 0);
      const rate = Number(inv.gstRate || 0);
      if (rate >= 5) {
        box1aSalesStandardAmount += subtotal;
        box1aSalesStandardVat += vatAmount;
      } else if (rate === 0) {
        box2SalesZero += subtotal;
      } else {
        box3SalesExempt += subtotal;
      }
    }

    const allBills = await db.select().from(supplierBills)
      .where(and(eq(supplierBills.tenantId, tenantId), gte(supplierBills.billDate, periodStart), lte(supplierBills.billDate, periodEnd)));

    let box9PurchasesStandardAmount = 0;
    let box9PurchasesStandardVat = 0;

    for (const bill of allBills) {
      if (!bill.isDeductible) continue;
      const subtotal = Number(bill.subtotal || 0);
      const vatAmount = Number(bill.vatAmount || 0);
      box9PurchasesStandardAmount += subtotal;
      box9PurchasesStandardVat += vatAmount;
    }

    const totalOutputVat = box1aSalesStandardVat;
    const totalInputVat = box9PurchasesStandardVat;
    const netVatPayable = totalOutputVat - totalInputVat;

    return {
      box1aSalesStandardAmount: Math.round(box1aSalesStandardAmount * 100) / 100,
      box1aSalesStandardVat: Math.round(box1aSalesStandardVat * 100) / 100,
      box2SalesZero: Math.round(box2SalesZero * 100) / 100,
      box3SalesExempt: Math.round(box3SalesExempt * 100) / 100,
      box9PurchasesStandardAmount: Math.round(box9PurchasesStandardAmount * 100) / 100,
      box9PurchasesStandardVat: Math.round(box9PurchasesStandardVat * 100) / 100,
      totalOutputVat: Math.round(totalOutputVat * 100) / 100,
      totalInputVat: Math.round(totalInputVat * 100) / 100,
      netVatPayable: Math.round(netVatPayable * 100) / 100,
    };
  }

  async getCorporateTaxReturnsByTenant(tenantId: string): Promise<CorporateTaxReturn[]> {
    return db.select().from(corporateTaxReturns).where(eq(corporateTaxReturns.tenantId, tenantId)).orderBy(desc(corporateTaxReturns.fyStart));
  }

  async getCorporateTaxReturn(id: string): Promise<CorporateTaxReturn | undefined> {
    const [ret] = await db.select().from(corporateTaxReturns).where(eq(corporateTaxReturns.id, id));
    return ret;
  }

  async createCorporateTaxReturn(ret: InsertCorporateTaxReturn): Promise<CorporateTaxReturn> {
    const [created] = await db.insert(corporateTaxReturns).values(ret as any).returning();
    return created;
  }

  async updateCorporateTaxReturn(id: string, data: Partial<InsertCorporateTaxReturn>): Promise<CorporateTaxReturn | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getCorporateTaxReturn(id);
    const [updated] = await db.update(corporateTaxReturns).set(data as any).where(eq(corporateTaxReturns.id, id)).returning();
    return updated;
  }

  async deleteCorporateTaxReturn(id: string): Promise<void> {
    await db.delete(corporateTaxReturns).where(eq(corporateTaxReturns.id, id));
  }

  async computeCorporateTaxReturn(tenantId: string, fyStart: string, fyEnd: string) {
    const start = new Date(fyStart);
    const end = new Date(fyEnd);
    end.setHours(23, 59, 59, 999);

    const allInvoices = await db.select().from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), between(invoices.createdAt, start, end)));
    const totalRevenue = allInvoices.reduce((sum, inv) => sum + Number(inv.subtotal || 0), 0);

    const allBills = await db.select().from(supplierBills)
      .where(and(eq(supplierBills.tenantId, tenantId), gte(supplierBills.billDate, fyStart), lte(supplierBills.billDate, fyEnd)));
    const totalExpenses = allBills.reduce((sum, b) => sum + Number(b.subtotal || 0), 0);

    const accountingProfit = totalRevenue - totalExpenses;
    const taxableIncome = Math.max(0, accountingProfit);
    const threshold = 375000;
    const taxRate = 0.09;
    const taxDue = taxableIncome > threshold ? (taxableIncome - threshold) * taxRate : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      accountingProfit: Math.round(accountingProfit * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      taxDue: Math.round(taxDue * 100) / 100,
    };
  }

  async getFixedAssetsByTenant(tenantId: string): Promise<FixedAsset[]> {
    return db.select().from(fixedAssets).where(eq(fixedAssets.tenantId, tenantId)).orderBy(desc(fixedAssets.createdAt));
  }

  async getFixedAsset(id: string): Promise<FixedAsset | undefined> {
    const [asset] = await db.select().from(fixedAssets).where(eq(fixedAssets.id, id));
    return asset;
  }

  async createFixedAsset(asset: InsertFixedAsset): Promise<FixedAsset> {
    const [created] = await db.insert(fixedAssets).values(asset as any).returning();
    return created;
  }

  async updateFixedAsset(id: string, data: Partial<InsertFixedAsset>): Promise<FixedAsset | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getFixedAsset(id);
    const [updated] = await db.update(fixedAssets).set(data as any).where(eq(fixedAssets.id, id)).returning();
    return updated;
  }

  async deleteFixedAsset(id: string): Promise<void> {
    await db.delete(fixedAssets).where(eq(fixedAssets.id, id));
  }

  async getMembershipTransfersByTenant(tenantId: string): Promise<MembershipTransfer[]> {
    return db.select().from(membershipTransfers).where(eq(membershipTransfers.tenantId, tenantId)).orderBy(desc(membershipTransfers.createdAt));
  }

  async getMembershipTransfer(id: string): Promise<MembershipTransfer | undefined> {
    const [t] = await db.select().from(membershipTransfers).where(eq(membershipTransfers.id, id));
    return t;
  }

  async createMembershipTransfer(transfer: InsertMembershipTransfer): Promise<MembershipTransfer> {
    const [created] = await db.insert(membershipTransfers).values(transfer as any).returning();
    return created;
  }

  async updateMembershipTransfer(id: string, data: Partial<InsertMembershipTransfer>): Promise<MembershipTransfer | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getMembershipTransfer(id);
    const [updated] = await db.update(membershipTransfers).set(data as any).where(eq(membershipTransfers.id, id)).returning();
    return updated;
  }

  async executeMembershipTransfer(id: string, approvedBy: string): Promise<MembershipTransfer | undefined> {
    const transfer = await this.getMembershipTransfer(id);
    if (!transfer) return undefined;
    if (transfer.status === "completed") return transfer;

    const [fromMember] = await db.select().from(members).where(eq(members.id, transfer.fromMemberId));
    const [toMember] = await db.select().from(members).where(eq(members.id, transfer.toMemberId));
    if (!fromMember || !toMember) return undefined;

    await db.update(members).set({
      membershipPlanId: fromMember.membershipPlanId,
      membershipType: fromMember.membershipType,
      membershipStart: fromMember.membershipStart,
      membershipEnd: fromMember.membershipEnd,
      status: "active",
    } as any).where(eq(members.id, transfer.toMemberId));

    await db.update(members).set({
      membershipPlanId: null,
      membershipEnd: null,
      status: "transferred",
    } as any).where(eq(members.id, transfer.fromMemberId));

    const now = new Date();
    const [updated] = await db.update(membershipTransfers).set({
      status: "completed",
      approvedBy,
      approvedAt: now,
      executedAt: now,
    } as any).where(eq(membershipTransfers.id, id)).returning();

    await db.insert(activities).values({
      tenantId: transfer.tenantId,
      userId: approvedBy,
      type: "membership_transfer",
      description: `Membership transferred from ${fromMember.firstName} ${fromMember.lastName} to ${toMember.firstName} ${toMember.lastName}`,
      metadata: { transferId: id, fromMemberId: transfer.fromMemberId, toMemberId: transfer.toMemberId },
    } as any);

    return updated;
  }

  async getSalesToday(tenantId: string) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayPayments = await db.select().from(paymentRecords).where(and(
      eq(paymentRecords.tenantId, tenantId),
      eq(paymentRecords.status, "completed"),
      between(paymentRecords.createdAt, todayStart, todayEnd),
    ));

    let cashTotal = 0, creditTotal = 0, cashCount = 0, creditCount = 0;
    for (const p of todayPayments) {
      const amt = Number(p.amount || 0);
      const m = (p.method || "cash").toLowerCase();
      if (m === "cash") { cashTotal += amt; cashCount++; }
      else { creditTotal += amt; creditCount++; }
    }

    return {
      perDayTotal: Math.round((cashTotal + creditTotal) * 100) / 100,
      cashTotal: Math.round(cashTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      perDayCount: todayPayments.length,
      cashCount,
      creditCount,
    };
  }

  async getDashboardAlerts(tenantId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allMembers = await db.select().from(members).where(eq(members.tenantId, tenantId));

    const birthdaysToday = allMembers
      .filter(m => {
        if (!m.dateOfBirth) return false;
        const dob = new Date(m.dateOfBirth as any);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      })
      .map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, dateOfBirth: m.dateOfBirth as any }));

    const expiringSoon = allMembers
      .filter(m => {
        if (!m.membershipEnd || m.status !== "active") return false;
        const end = new Date(m.membershipEnd);
        return end >= now && end <= sevenDaysLater;
      })
      .map(m => {
        const end = new Date(m.membershipEnd!);
        const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        return { id: m.id, firstName: m.firstName, lastName: m.lastName, membershipEnd: m.membershipEnd as any, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todaysSessions = await db.select().from(trainerSessions).where(and(
      eq(trainerSessions.tenantId, tenantId),
      gte(trainerSessions.startTime, todayStart),
      lte(trainerSessions.startTime, todayEnd),
    ));

    const ptSessionsToday = todaysSessions
      .filter(s => (s.type || "personal") === "personal")
      .map(s => ({
        id: s.id, title: s.title, trainerId: s.trainerId,
        startTime: s.startTime as any, endTime: s.endTime as any,
      }));

    return { birthdaysToday, expiringSoon, ptSessionsToday };
  }

  // ─── Biometric: Devices ───────────────────────────────────
  async getDevicesByTenant(tenantId: string): Promise<Device[]> {
    return db.select().from(devices)
      .where(eq(devices.tenantId, tenantId))
      .orderBy(desc(devices.createdAt));
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [d] = await db.select().from(devices).where(eq(devices.id, id));
    return d;
  }

  async getDeviceBySerial(serialNumber: string): Promise<Device | undefined> {
    const [d] = await db.select().from(devices).where(eq(devices.serialNumber, serialNumber));
    return d;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    // drizzle-zod can't perfectly mirror jsonb columns with $type<> annotations
    // (capabilities here), so cast structurally to the table's inferred insert
    // type at the call site. This is a typed cast, not `any`.
    const [created] = await db
      .insert(devices)
      .values(device as typeof devices.$inferInsert)
      .returning();
    return created;
  }

  async updateDevice(
    id: string,
    data: Partial<typeof devices.$inferInsert>,
  ): Promise<Device | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getDevice(id);
    const [updated] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    // Audit-preserving delete: drop in-flight commands (worthless without the
    // device), null out template + event device references (the schema's
    // ON DELETE SET NULL FK does this automatically), then remove the device.
    // Templates remain associated to the member; admins can re-push to a
    // replacement reader via the enrolment screen. Access events keep their
    // tenant + member references so the audit trail survives device retirement.
    await db.delete(doorCommands).where(eq(doorCommands.deviceId, id));
    await db.delete(devices).where(eq(devices.id, id));
  }

  // ─── Biometric: Templates ─────────────────────────────────
  async getTemplatesByMember(memberId: string): Promise<BiometricTemplate[]> {
    const rows = await db.select().from(biometricTemplates)
      .where(eq(biometricTemplates.memberId, memberId))
      .orderBy(desc(biometricTemplates.enrolledAt));
    return rows.map((r) => this.decryptTemplateRow(r));
  }

  async getTemplatesByTenant(tenantId: string): Promise<BiometricTemplate[]> {
    const rows = await db.select().from(biometricTemplates)
      .where(eq(biometricTemplates.tenantId, tenantId))
      .orderBy(desc(biometricTemplates.enrolledAt));
    return rows.map((r) => this.decryptTemplateRow(r));
  }

  async getTemplate(id: string): Promise<BiometricTemplate | undefined> {
    const [t] = await db.select().from(biometricTemplates).where(eq(biometricTemplates.id, id));
    return t ? this.decryptTemplateRow(t) : t;
  }

  async getTemplateByExternalRef(deviceId: string, externalRef: string): Promise<BiometricTemplate | undefined> {
    const [t] = await db.select().from(biometricTemplates)
      .where(and(eq(biometricTemplates.deviceId, deviceId), eq(biometricTemplates.externalRef, externalRef)));
    return t ? this.decryptTemplateRow(t) : t;
  }

  async createTemplate(template: InsertBiometricTemplate): Promise<BiometricTemplate> {
    // Encrypt the raw template bytes AND any face/photo preview bytes at rest.
    // Reads through this storage layer transparently decrypt; logs/admin
    // queries will never see plaintext biometric data.
    const payload: Partial<InsertBiometricTemplate> & { templateData?: string | null; imagePreviewUrl?: string | null } = { ...template };
    if (typeof payload.templateData === "string") {
      payload.templateData = encryptString(payload.templateData) ?? undefined;
    }
    if (typeof payload.imagePreviewUrl === "string") {
      payload.imagePreviewUrl = encryptString(payload.imagePreviewUrl) ?? undefined;
    }
    const [created] = await db.insert(biometricTemplates).values(payload as InsertBiometricTemplate).returning();
    return this.decryptTemplateRow(created);
  }

  async updateTemplate(id: string, data: Partial<InsertBiometricTemplate>): Promise<BiometricTemplate | undefined> {
    if (!data || Object.keys(data).length === 0) return this.getTemplate(id);
    const payload: Partial<InsertBiometricTemplate> & { templateData?: string | null; imagePreviewUrl?: string | null } = { ...data };
    if (typeof payload.templateData === "string") {
      payload.templateData = encryptString(payload.templateData) ?? undefined;
    }
    if (typeof payload.imagePreviewUrl === "string") {
      payload.imagePreviewUrl = encryptString(payload.imagePreviewUrl) ?? undefined;
    }
    const [updated] = await db.update(biometricTemplates).set(payload).where(eq(biometricTemplates.id, id)).returning();
    return updated ? this.decryptTemplateRow(updated) : updated;
  }

  private decryptTemplateRow(t: BiometricTemplate): BiometricTemplate {
    if (!t) return t;
    if (typeof t.templateData === "string") {
      const dec = decryptString(t.templateData);
      if (dec != null) t.templateData = dec;
    }
    if (typeof t.imagePreviewUrl === "string") {
      const dec = decryptString(t.imagePreviewUrl);
      if (dec != null) t.imagePreviewUrl = dec;
    }
    return t;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(biometricTemplates).where(eq(biometricTemplates.id, id));
  }

  async deleteTemplatesByMember(memberId: string): Promise<void> {
    await db.delete(biometricTemplates).where(eq(biometricTemplates.memberId, memberId));
  }

  // ─── Biometric: Access events ─────────────────────────────
  async getAccessEventsByTenant(tenantId: string, opts: { branchId?: string; deviceId?: string; memberId?: string; decision?: string; limit?: number } = {}): Promise<AccessEvent[]> {
    const conditions = [eq(accessEvents.tenantId, tenantId)];
    if (opts.branchId) conditions.push(eq(accessEvents.branchId, opts.branchId));
    if (opts.deviceId) conditions.push(eq(accessEvents.deviceId, opts.deviceId));
    if (opts.memberId) conditions.push(eq(accessEvents.memberId, opts.memberId));
    if (opts.decision) conditions.push(eq(accessEvents.decision, opts.decision));
    const rows = await db.select().from(accessEvents)
      .where(and(...conditions))
      .orderBy(desc(accessEvents.capturedAt))
      .limit(opts.limit ?? 200);
    return rows.map((r) => this.decryptAccessEventRow(r));
  }

  async getAccessEventsByMember(memberId: string, limit = 50): Promise<AccessEvent[]> {
    const rows = await db.select().from(accessEvents)
      .where(eq(accessEvents.memberId, memberId))
      .orderBy(desc(accessEvents.capturedAt))
      .limit(limit);
    return rows.map((r) => this.decryptAccessEventRow(r));
  }

  async createAccessEvent(event: InsertAccessEvent): Promise<AccessEvent> {
    // Raw payloads can include face crops, fingerprint vendor blobs, and other
    // PII the device echoes back. Photo URLs from device callbacks may also
    // contain biometric data. Encrypt at rest. The encrypted blob is stored as
    // a JSON string inside the jsonb column (jsonb accepts any JSON value).
    const values: typeof accessEvents.$inferInsert = {
      ...event,
      rawPayload: event.rawPayload != null ? encryptJson(event.rawPayload) : event.rawPayload,
      photoUrl: typeof event.photoUrl === "string" ? (encryptString(event.photoUrl) ?? event.photoUrl) : event.photoUrl,
    };
    const [created] = await db.insert(accessEvents).values(values).returning();
    return this.decryptAccessEventRow(created);
  }

  private decryptAccessEventRow(e: AccessEvent): AccessEvent {
    if (!e) return e;
    if (typeof e.rawPayload === "string") {
      const dec = decryptJson(e.rawPayload);
      if (dec != null) e.rawPayload = dec;
    }
    if (typeof e.photoUrl === "string") {
      const dec = decryptString(e.photoUrl);
      if (dec != null) e.photoUrl = dec;
    }
    return e;
  }

  // ─── Biometric: Idempotency ───────────────────────────────
  async isBiometricEventProcessed(id: string): Promise<boolean> {
    const [row] = await db.select({ id: processedBiometricEvents.id })
      .from(processedBiometricEvents)
      .where(eq(processedBiometricEvents.id, id));
    return !!row;
  }

  async markBiometricEventProcessed(id: string, deviceId: string): Promise<void> {
    await db.insert(processedBiometricEvents)
      .values({ id, deviceId })
      .onConflictDoNothing();
  }

  // Atomic claim: returns true iff this caller is the first to insert the
  // dedupe row. Concurrent duplicate webhook deliveries lose the race and get
  // false back, so they skip the access-event/attendance/door side effects.
  async claimBiometricEvent(id: string, deviceId: string): Promise<boolean> {
    const inserted = await db.insert(processedBiometricEvents)
      .values({ id, deviceId })
      .onConflictDoNothing()
      .returning({ id: processedBiometricEvents.id });
    return inserted.length > 0;
  }

  // ─── Biometric: Door commands ─────────────────────────────
  async getDoorCommand(id: string): Promise<DoorCommand | undefined> {
    const [cmd] = await db.select().from(doorCommands).where(eq(doorCommands.id, id));
    return cmd;
  }

  async getPendingDoorCommands(deviceId: string): Promise<DoorCommand[]> {
    return db.select().from(doorCommands)
      .where(and(eq(doorCommands.deviceId, deviceId), eq(doorCommands.status, "pending")))
      .orderBy(doorCommands.createdAt)
      .limit(10);
  }

  async getDoorCommandByIdempotencyKey(key: string): Promise<DoorCommand | undefined> {
    const [cmd] = await db.select().from(doorCommands).where(eq(doorCommands.idempotencyKey, key));
    return cmd;
  }

  async createDoorCommand(cmd: InsertDoorCommand): Promise<DoorCommand> {
    const [created] = await db.insert(doorCommands).values(cmd).returning();
    return created;
  }

  async markDoorCommandPickedUp(id: string): Promise<void> {
    await db.update(doorCommands).set({
      status: "picked_up",
      pickedUpAt: new Date(),
      attempts: sql`${doorCommands.attempts} + 1`,
    }).where(eq(doorCommands.id, id));
  }

  async markDoorCommandComplete(id: string, status: "done" | "failed", error?: string): Promise<void> {
    await db.update(doorCommands).set({
      status,
      completedAt: new Date(),
      errorMessage: error ?? null,
    }).where(eq(doorCommands.id, id));
  }
}

export const storage = new DatabaseStorage();
