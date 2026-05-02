import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, date, type AnyPgColumn } from "drizzle-orm/pg-core";
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
  trn: text("trn"),
  vatRegisteredOn: date("vat_registered_on"),
  vatFilingFrequency: text("vat_filing_frequency").default("quarterly"),
  ctTrn: text("ct_trn"),
  ctRegisteredOn: date("ct_registered_on"),
  fyStartMonth: integer("fy_start_month").default(1),
  legalName: text("legal_name"),
  tradeLicenseNumber: text("trade_license_number"),
  isActive: boolean("is_active").default(true),
  trialEndsAt: timestamp("trial_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trialing"),
  subscriptionInterval: text("subscription_interval").default("monthly"),
  currentPeriodEnd: timestamp("current_period_end"),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierBills = pgTable("supplier_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  billNumber: text("bill_number").notNull(),
  billDate: date("bill_date").notNull(),
  description: text("description"),
  category: text("category").default("operating"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  vatRate: decimal("vat_rate", { precision: 4, scale: 2 }).default("5"),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  vatTreatment: text("vat_treatment").default("standard"),
  isDeductible: boolean("is_deductible").default(true),
  status: text("status").default("unpaid"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vatReturns = pgTable("vat_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  box1aSalesStandardAmount: decimal("box1a_sales_std_amount", { precision: 14, scale: 2 }).default("0"),
  box1aSalesStandardVat: decimal("box1a_sales_std_vat", { precision: 14, scale: 2 }).default("0"),
  box2SalesZero: decimal("box2_sales_zero", { precision: 14, scale: 2 }).default("0"),
  box3SalesExempt: decimal("box3_sales_exempt", { precision: 14, scale: 2 }).default("0"),
  box4ReverseChargeAmount: decimal("box4_reverse_charge_amount", { precision: 14, scale: 2 }).default("0"),
  box4ReverseChargeVat: decimal("box4_reverse_charge_vat", { precision: 14, scale: 2 }).default("0"),
  box6GoodsImportAmount: decimal("box6_imports_amount", { precision: 14, scale: 2 }).default("0"),
  box6GoodsImportVat: decimal("box6_imports_vat", { precision: 14, scale: 2 }).default("0"),
  box9PurchasesStandardAmount: decimal("box9_purchases_std_amount", { precision: 14, scale: 2 }).default("0"),
  box9PurchasesStandardVat: decimal("box9_purchases_std_vat", { precision: 14, scale: 2 }).default("0"),
  totalOutputVat: decimal("total_output_vat", { precision: 14, scale: 2 }).default("0"),
  totalInputVat: decimal("total_input_vat", { precision: 14, scale: 2 }).default("0"),
  netVatPayable: decimal("net_vat_payable", { precision: 14, scale: 2 }).default("0"),
  filedAt: timestamp("filed_at"),
  filedBy: varchar("filed_by"),
  ftaReference: text("fta_reference"),
  paymentRecordId: varchar("payment_record_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const corporateTaxReturns = pgTable("corporate_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  fyStart: date("fy_start").notNull(),
  fyEnd: date("fy_end").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  totalRevenue: decimal("total_revenue", { precision: 14, scale: 2 }).default("0"),
  totalExpenses: decimal("total_expenses", { precision: 14, scale: 2 }).default("0"),
  accountingProfit: decimal("accounting_profit", { precision: 14, scale: 2 }).default("0"),
  addBacks: decimal("add_backs", { precision: 14, scale: 2 }).default("0"),
  exemptIncome: decimal("exempt_income", { precision: 14, scale: 2 }).default("0"),
  reliefClaimed: decimal("relief_claimed", { precision: 14, scale: 2 }).default("0"),
  smallBusinessRelief: boolean("small_business_relief").default(false),
  taxableIncome: decimal("taxable_income", { precision: 14, scale: 2 }).default("0"),
  threshold: decimal("threshold", { precision: 14, scale: 2 }).default("375000"),
  taxRate: decimal("tax_rate", { precision: 4, scale: 2 }).default("9"),
  taxDue: decimal("tax_due", { precision: 14, scale: 2 }).default("0"),
  filedAt: timestamp("filed_at"),
  filedBy: varchar("filed_by"),
  ftaReference: text("fta_reference"),
  paymentRecordId: varchar("payment_record_id"),
  adjustments: jsonb("adjustments").$type<{ label: string; amount: number; type: "add" | "deduct" }[]>().default([]),
  notes: text("notes"),
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
  nationality: text("nationality"),
  dateOfBirth: date("date_of_birth"),
  salespersonId: varchar("salesperson_id").references(() => users.id),
  emergencyContact: text("emergency_contact"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactRelation: text("emergency_contact_relation"),
  notes: text("notes"),
  heightCm: decimal("height_cm", { precision: 5, scale: 1 }),
  weightKg: decimal("weight_kg", { precision: 5, scale: 1 }),
  bmi: decimal("bmi", { precision: 4, scale: 1 }),
  trainerId: varchar("trainer_id").references(() => users.id),
  referralCode: text("referral_code"),
  referredBy: varchar("referred_by"),
  signatureDataUrl: text("signature_data_url"),
  waiverAcceptedAt: timestamp("waiver_accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fixedAssets = pgTable("fixed_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"),
  assetCode: text("asset_code"),
  name: text("name").notNull(),
  category: text("category").notNull().default("equipment"),
  location: text("location"),
  vendorName: text("vendor_name"),
  vendorContact: text("vendor_contact"),
  purchaseDate: date("purchase_date"),
  purchaseValue: decimal("purchase_value", { precision: 12, scale: 2 }).default("0"),
  depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }).default("0"),
  warrantyExpiry: date("warranty_expiry"),
  amcExpiry: date("amc_expiry"),
  serialNumber: text("serial_number"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipTransfers = pgTable("membership_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  fromMemberId: varchar("from_member_id").references(() => members.id).notNull(),
  toMemberId: varchar("to_member_id").references(() => members.id).notNull(),
  membershipPlanId: varchar("membership_plan_id"),
  remainingDays: integer("remaining_days"),
  transferFee: decimal("transfer_fee", { precision: 10, scale: 2 }).default("0"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  notes: text("notes"),
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
  // For biometric/RFID check-ins, link the device that recorded the entry
  // so audit + analytics can join attendance back to the reader. Nullable
  // because manual check-ins have no device, and ON DELETE SET NULL
  // preserves attendance history when a reader is retired. The () => arrow
  // defers resolution past the devices table declaration further down.
  deviceId: varchar("device_id").references((): AnyPgColumn => devices.id, { onDelete: "set null" }),
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
  stripeProductId: text("stripe_product_id"),
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  stripeAnnualPriceId: text("stripe_annual_price_id"),
});

// Track Stripe webhook events that have been processed (idempotency).
export const processedStripeEvents = pgTable("processed_stripe_events", {
  id: varchar("id").primaryKey(), // stripe event id, e.g. evt_...
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

// ─── Biometric Access Control ─────────────────────────────────────────
// Physical entry devices (face / fingerprint / RFID readers) installed at
// a branch door. brand selects the adapter at runtime; secret authenticates
// inbound webhook traffic from the device or relay.
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"),
  brand: text("brand").notNull(), // zkteco | essl | hikvision | suprema | matrix | anviz | realtime | dahua | idemia | virdi | hid
  model: text("model"),
  name: text("name").notNull(),
  serialNumber: text("serial_number").notNull().unique(),
  ipAddress: text("ip_address"),
  port: integer("port"),
  username: text("username"),
  passwordEnc: text("password_enc"), // device-side login password (encrypted at rest in production deployments)
  secret: text("secret").notNull(), // shared secret used to HMAC-verify webhook payloads
  mode: text("mode").notNull().default("cloud_push"), // cloud_push | local_relay
  capabilities: jsonb("capabilities").$type<{ face?: boolean; fingerprint?: boolean; card?: boolean; door?: boolean }>().default({ face: true, fingerprint: true, card: false, door: true }),
  doorOpenSeconds: integer("door_open_seconds").default(5),
  status: text("status").notNull().default("offline"), // online | offline | error
  lastSeenAt: timestamp("last_seen_at"),
  lastError: text("last_error"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Biometric enrolment templates per member. deviceId nullable means
// the template is logically global (Fitro360-side master) and may be
// pushed to several devices. templateData is the device-native binary
// blob, opaque to us; we never re-derive face vectors.
export const biometricTemplates = pgTable("biometric_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  deviceId: varchar("device_id").references(() => devices.id, { onDelete: "set null" }),
  templateType: text("template_type").notNull().default("face"), // face | fingerprint | card
  templateData: text("template_data"), // base64 device-native template (encrypted at rest in prod)
  externalRef: text("external_ref"), // device-side user id / pin
  imagePreviewUrl: text("image_preview_url"), // small preview for UI (not used for matching)
  status: text("status").notNull().default("active"), // active | failed | revoked
  syncStatus: text("sync_status").notNull().default("pending"), // pending | pushed | failed
  syncError: text("sync_error"),
  consentGiven: boolean("consent_given").default(false),
  consentAt: timestamp("consent_at"),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

// Every entry attempt — allowed or denied — across every device.
// memberId may be null for unrecognised faces; rawPayload retains
// the device's original event for forensics.
export const accessEvents = pgTable("access_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"),
  deviceId: varchar("device_id").references(() => devices.id, { onDelete: "set null" }),
  memberId: varchar("member_id").references(() => members.id),
  externalRef: text("external_ref"), // device-reported user id (when memberId not yet linked)
  eventType: text("event_type").notNull(), // entry | exit | denied | unknown_face | error
  decision: text("decision").notNull(), // allow | deny | error
  reason: text("reason"), // human-readable, e.g. "membership expired", "frozen", "wrong branch"
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  photoUrl: text("photo_url"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Outbound commands waiting to be picked up by a device or relay.
// idempotencyKey collapses repeat triggers within a short window
// (handled at the route layer) so a button-mashed door open turns
// into a single physical command.
export const doorCommands = pgTable("door_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  deviceId: varchar("device_id").references(() => devices.id).notNull(),
  command: text("command").notNull().default("open"), // open | enroll | delete | sync
  payload: jsonb("payload"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | picked_up | done | failed
  attempts: integer("attempts").default(0),
  pickedUpAt: timestamp("picked_up_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Idempotency table for inbound device events — same role as
// processed_stripe_events but for biometric webhooks.
export const processedBiometricEvents = pgTable("processed_biometric_events", {
  id: varchar("id").primaryKey(), // composite: deviceId + native event id
  deviceId: varchar("device_id"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

// Owner-defined custom rules layered on top of the built-in evaluateAccess
// gates. Each row is a single rule that DENIES entry when its condition
// matches. Evaluated after status/expiry/branch/waiver/invoice gates so
// owners can add tighter policies (e.g. "no entry for trial members on
// weekends", "no entry between 23:00-05:00 for any plan tagged
// 'budget'", "no entry for members tagged 'no-show'").
export const accessBlockRules = pgTable("access_block_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  branchId: varchar("branch_id"), // null = applies to every branch
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull(), // plan | membership_type | status | nationality | day_of_week | time_window
  // ruleValue stores the type-specific match data, all serialised as text:
  //   plan             → comma-separated membership_plan ids
  //   membership_type  → comma-separated cadences (monthly|quarterly|annual|trial|…)
  //   status           → comma-separated member.status values
  //   nationality      → comma-separated ISO codes
  //   day_of_week      → comma-separated 0-6 (0 = Sunday)
  //   time_window      → "HH:MM-HH:MM" in server local time
  ruleValue: text("rule_value").notNull(),
  reason: text("reason").notNull(), // shown to staff on the deny event
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(100), // lower = checked first
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Per-tenant biometric / GDPR settings. One row per tenant, lazily created
// when an owner first opens the biometric settings page. Defaults are
// conservative (24-month template retention, 12-month event retention).
export const tenantBiometricSettings = pgTable("tenant_biometric_settings", {
  tenantId: varchar("tenant_id").references(() => tenants.id).primaryKey(),
  templateRetentionMonths: integer("template_retention_months").notNull().default(24),
  eventRetentionMonths: integer("event_retention_months").notNull().default(12),
  // Whether to auto-purge templates as soon as a member is "cancelled" /
  // "transferred" rather than waiting the full retention period. Some
  // jurisdictions (e.g. EU GDPR) prefer the strictest interpretation.
  purgeOnCancellation: boolean("purge_on_cancellation").notNull().default(false),
  // The on-prem relay can subscribe to push notifications instead of polling.
  // We keep this here so the websocket gateway knows whether to emit.
  relayWsEnabled: boolean("relay_ws_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unmatched device-side enrolments surfaced by the periodic sync job. When
// the device-pull job sees a template the device knows about but Fitro360
// has no member mapping for, it logs one of these so the front desk can
// match it to the right member from the inbox.
export const unmatchedEnrolments = pgTable("unmatched_enrolments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  deviceId: varchar("device_id").references(() => devices.id, { onDelete: "cascade" }).notNull(),
  externalRef: text("external_ref").notNull(),
  displayName: text("display_name"),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  resolvedMemberId: varchar("resolved_member_id").references(() => members.id),
  resolvedAt: timestamp("resolved_at"),
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
export const insertSupplierBillSchema = createInsertSchema(supplierBills).omit({ id: true, createdAt: true });
export const insertVatReturnSchema = createInsertSchema(vatReturns).omit({ id: true, createdAt: true });
export const insertCorporateTaxReturnSchema = createInsertSchema(corporateTaxReturns).omit({ id: true, createdAt: true });
export const insertFixedAssetSchema = createInsertSchema(fixedAssets).omit({ id: true, createdAt: true });
export const insertMembershipTransferSchema = createInsertSchema(membershipTransfers).omit({ id: true, createdAt: true, approvedAt: true, executedAt: true });
export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, createdAt: true, lastSeenAt: true, lastError: true });
export const insertBiometricTemplateSchema = createInsertSchema(biometricTemplates).omit({ id: true, enrolledAt: true });
export const insertAccessEventSchema = createInsertSchema(accessEvents).omit({ id: true, createdAt: true });
export const insertDoorCommandSchema = createInsertSchema(doorCommands).omit({ id: true, createdAt: true, pickedUpAt: true, completedAt: true, attempts: true });
export const insertAccessBlockRuleSchema = createInsertSchema(accessBlockRules).omit({ id: true, createdAt: true });
export const insertTenantBiometricSettingsSchema = createInsertSchema(tenantBiometricSettings).omit({ updatedAt: true });
export const insertUnmatchedEnrolmentSchema = createInsertSchema(unmatchedEnrolments).omit({ id: true, firstSeenAt: true, lastSeenAt: true, resolvedAt: true });

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
export type InsertSupplierBill = z.infer<typeof insertSupplierBillSchema>;
export type SupplierBill = typeof supplierBills.$inferSelect;
export type InsertVatReturn = z.infer<typeof insertVatReturnSchema>;
export type VatReturn = typeof vatReturns.$inferSelect;
export type InsertCorporateTaxReturn = z.infer<typeof insertCorporateTaxReturnSchema>;
export type CorporateTaxReturn = typeof corporateTaxReturns.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertBiometricTemplate = z.infer<typeof insertBiometricTemplateSchema>;
export type BiometricTemplate = typeof biometricTemplates.$inferSelect;
export type InsertAccessEvent = z.infer<typeof insertAccessEventSchema>;
export type AccessEvent = typeof accessEvents.$inferSelect;
export type InsertDoorCommand = z.infer<typeof insertDoorCommandSchema>;
export type DoorCommand = typeof doorCommands.$inferSelect;
export type InsertAccessBlockRule = z.infer<typeof insertAccessBlockRuleSchema>;
export type AccessBlockRule = typeof accessBlockRules.$inferSelect;
export type InsertTenantBiometricSettings = z.infer<typeof insertTenantBiometricSettingsSchema>;
export type TenantBiometricSettings = typeof tenantBiometricSettings.$inferSelect;
export type InsertUnmatchedEnrolment = z.infer<typeof insertUnmatchedEnrolmentSchema>;
export type UnmatchedEnrolment = typeof unmatchedEnrolments.$inferSelect;
export type FixedAsset = typeof fixedAssets.$inferSelect;
export type InsertFixedAsset = z.infer<typeof insertFixedAssetSchema>;
export type MembershipTransfer = typeof membershipTransfers.$inferSelect;
export type InsertMembershipTransfer = z.infer<typeof insertMembershipTransferSchema>;
