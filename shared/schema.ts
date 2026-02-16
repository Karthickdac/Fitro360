import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymName: text("gym_name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#1e40af"),
  secondaryColor: text("secondary_color").default("#3b82f6"),
  domain: text("domain").unique(),
  subdomain: text("subdomain").unique(),
  subscriptionPlan: text("subscription_plan").default("basic"),
  appDisplayName: text("app_display_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  faviconUrl: text("favicon_url"),
  emailTemplateBg: text("email_template_bg").default("#ffffff"),
  emailTemplateAccent: text("email_template_accent"),
  smsSenderId: text("sms_sender_id"),
  invoiceHeader: text("invoice_header"),
  invoiceFooter: text("invoice_footer"),
  market: text("market").default("uae"),
  isActive: boolean("is_active").default(true),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  branchId: varchar("branch_id"),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("member"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  managerId: varchar("manager_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"),
  userId: varchar("user_id").references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  membershipPlanId: varchar("membership_plan_id"),
  membershipType: text("membership_type").notNull().default("monthly"),
  membershipStart: timestamp("membership_start").defaultNow(),
  membershipEnd: timestamp("membership_end"),
  status: text("status").notNull().default("active"),
  emergencyContact: text("emergency_contact"),
  notes: text("notes"),
  heightCm: decimal("height_cm", { precision: 5, scale: 1 }),
  weightKg: decimal("weight_kg", { precision: 5, scale: 1 }),
  bmi: decimal("bmi", { precision: 4, scale: 1 }),
  trainerId: varchar("trainer_id").references(() => users.id),
  referralCode: text("referral_code"),
  referredBy: varchar("referred_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  branchId: varchar("branch_id"),
  checkInTime: timestamp("check_in_time").defaultNow(),
  checkOutTime: timestamp("check_out_time"),
  method: text("method").default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainerSessions = pgTable("trainer_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  trainerId: varchar("trainer_id").references(() => users.id).notNull(),
  branchId: varchar("branch_id"),
  title: text("title").notNull(),
  type: text("type").notNull().default("personal"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  capacity: integer("capacity").default(1),
  enrolled: integer("enrolled").default(0),
  status: text("status").default("scheduled"),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessionBookings = pgTable("session_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => trainerSessions.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  status: text("status").default("confirmed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").default(0),
  minStock: integer("min_stock").default(5),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }),
  supplierId: varchar("supplier_id"),
  status: text("status").default("in_stock"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxNumber: text("gst_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  type: text("type").notNull().default("sale"),
  customerId: varchar("customer_id"),
  items: jsonb("items").$type<{ name: string; quantity: number; unitPrice: number; total: number }[]>().default([]),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  gstRate: decimal("gst_rate", { precision: 4, scale: 2 }).default("5"),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  channel: text("channel").default("in_app"),
  isRead: boolean("is_read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  code: text("code").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  referrerId: varchar("referrer_id").references(() => members.id).notNull(),
  referredMemberId: varchar("referred_member_id").references(() => members.id),
  referralCode: text("referral_code").notNull(),
  status: text("status").default("pending"),
  rewardType: text("reward_type").default("discount"),
  rewardValue: decimal("reward_value", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberMetrics = pgTable("member_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  heightCm: decimal("height_cm", { precision: 5, scale: 1 }),
  weightKg: decimal("weight_kg", { precision: 5, scale: 1 }),
  bmi: decimal("bmi", { precision: 4, scale: 1 }),
  bodyFatPct: decimal("body_fat_pct", { precision: 4, scale: 1 }),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  equipmentId: varchar("equipment_id").references(() => equipment.id).notNull(),
  type: text("type").notNull().default("routine"),
  description: text("description").notNull(),
  status: text("status").notNull().default("scheduled"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  completedDate: timestamp("completed_date"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memberId: varchar("member_id").references(() => members.id),
  invoiceId: varchar("invoice_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("AED"),
  method: text("method").notNull().default("cash"),
  status: text("status").notNull().default("completed"),
  description: text("description"),
  stripePaymentId: text("stripe_payment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainerCommissions = pgTable("trainer_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  trainerId: varchar("trainer_id").references(() => users.id).notNull(),
  sessionId: varchar("session_id").references(() => trainerSessions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull().default("session"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainerLeaves = pgTable("trainer_leaves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  trainerId: varchar("trainer_id").references(() => users.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trainerProfiles = pgTable("trainer_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bio: text("bio"),
  specializations: jsonb("specializations").$type<string[]>().default([]),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  experienceYears: integer("experience_years").default(0),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  availability: text("availability"),
  socialLinks: jsonb("social_links").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipPlans = pgTable("membership_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  durationType: text("duration_type").notNull().default("monthly"),
  durationDays: integer("duration_days").notNull().default(30),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AED"),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default("0"),
  features: jsonb("features").$type<string[]>().default([]),
  maxFreezeDays: integer("max_freeze_days").default(0),
  guestPasses: integer("guest_passes").default(0),
  personalTrainerSessions: integer("personal_trainer_sessions").default(0),
  lockerAccess: boolean("locker_access").default(false),
  towelService: boolean("towel_service").default(false),
  groupClasses: boolean("group_classes").default(false),
  personalTraining: boolean("personal_training").default(false),
  color: text("color").default("#6366f1"),
  isPopular: boolean("is_popular").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceAnnual: decimal("price_annual", { precision: 10, scale: 2 }).notNull(),
  maxMembers: integer("max_members"),
  features: jsonb("features").$type<string[]>().default([]),
  isPopular: boolean("is_popular").default(false),
  isActive: boolean("is_active").default(true),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true });
export const insertMemberSchema = createInsertSchema(members).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertTrainerSessionSchema = createInsertSchema(trainerSessions).omit({ id: true, createdAt: true });
export const insertSessionBookingSchema = createInsertSchema(sessionBookings).omit({ id: true, createdAt: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export const insertMemberMetricSchema = createInsertSchema(memberMetrics).omit({ id: true, recordedAt: true });
export const insertEquipmentMaintenanceSchema = createInsertSchema(equipmentMaintenance).omit({ id: true, createdAt: true });
export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({ id: true, createdAt: true });
export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true });
export const insertTrainerCommissionSchema = createInsertSchema(trainerCommissions).omit({ id: true, createdAt: true });
export const insertTrainerLeaveSchema = createInsertSchema(trainerLeaves).omit({ id: true, createdAt: true });
export const insertTrainerProfileSchema = createInsertSchema(trainerProfiles).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertTrainerSession = z.infer<typeof insertTrainerSessionSchema>;
export type TrainerSession = typeof trainerSessions.$inferSelect;
export type InsertSessionBooking = z.infer<typeof insertSessionBookingSchema>;
export type SessionBooking = typeof sessionBookings.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertMemberMetric = z.infer<typeof insertMemberMetricSchema>;
export type MemberMetric = typeof memberMetrics.$inferSelect;
export type InsertEquipmentMaintenance = z.infer<typeof insertEquipmentMaintenanceSchema>;
export type EquipmentMaintenance = typeof equipmentMaintenance.$inferSelect;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertTrainerCommission = z.infer<typeof insertTrainerCommissionSchema>;
export type TrainerCommission = typeof trainerCommissions.$inferSelect;
export type InsertTrainerLeave = z.infer<typeof insertTrainerLeaveSchema>;
export type TrainerLeave = typeof trainerLeaves.$inferSelect;
export type InsertTrainerProfile = z.infer<typeof insertTrainerProfileSchema>;
export type TrainerProfile = typeof trainerProfiles.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
