import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { users, tenants, subscriptionPlans, members, activities, branches, equipment, suppliers } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existingPlans = await storage.getAllPlans();
  if (existingPlans.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  await storage.createPlan({
    name: "basic",
    priceMonthly: "29.00",
    priceAnnual: "290.00",
    maxMembers: 100,
    features: [
      "Web admin panel",
      "Member management",
      "Basic reporting",
      "Email support",
      "Up to 100 members",
    ],
    isPopular: false,
    isActive: true,
  });

  await storage.createPlan({
    name: "pro",
    priceMonthly: "79.00",
    priceAnnual: "790.00",
    maxMembers: 500,
    features: [
      "Everything in Basic",
      "Mobile app access",
      "Trainer management",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
      "Up to 500 members",
    ],
    isPopular: true,
    isActive: true,
  });

  await storage.createPlan({
    name: "enterprise",
    priceMonthly: "199.00",
    priceAnnual: "1990.00",
    maxMembers: 5000,
    features: [
      "Everything in Pro",
      "Multi-branch support",
      "Equipment sales ERP",
      "White-label mobile app",
      "Dedicated support",
      "Custom integrations",
      "API access",
      "Up to 5,000 members",
    ],
    isPopular: false,
    isActive: true,
  });

  const adminPassword = await bcrypt.hash("admin123", 10);
  await storage.createUser({
    username: "admin",
    email: "admin@forgefit.com",
    password: adminPassword,
    role: "platform_admin",
    firstName: "Platform",
    lastName: "Admin",
    isActive: true,
    tenantId: null,
  });

  const tenant1 = await storage.createTenant({
    gymName: "Iron Temple Fitness",
    email: "info@irontemple.com",
    primaryColor: "#1e40af",
    secondaryColor: "#3b82f6",
    domain: "irontemple.forgefit.com",
    subscriptionPlan: "pro",
    appDisplayName: "Iron Temple",
    phone: "+1 555-0101",
    address: "123 Fitness Ave, Los Angeles, CA 90012",
    isActive: true,
  });

  const tenant2 = await storage.createTenant({
    gymName: "Peak Performance Gym",
    email: "hello@peakperformance.com",
    primaryColor: "#059669",
    secondaryColor: "#10b981",
    domain: "peak.forgefit.com",
    subscriptionPlan: "enterprise",
    appDisplayName: "Peak Performance",
    phone: "+1 555-0202",
    address: "456 Muscle Blvd, Miami, FL 33101",
    isActive: true,
  });

  const tenant3 = await storage.createTenant({
    gymName: "FitZone Studios",
    email: "contact@fitzone.com",
    primaryColor: "#7c3aed",
    secondaryColor: "#8b5cf6",
    domain: "fitzone.forgefit.com",
    subscriptionPlan: "basic",
    appDisplayName: "FitZone",
    phone: "+1 555-0303",
    address: "789 Gym Lane, New York, NY 10001",
    isActive: true,
  });

  const gymOwnerPassword = await bcrypt.hash("gym123", 10);
  await storage.createUser({
    tenantId: tenant1.id,
    username: "gymowner",
    email: "owner@irontemple.com",
    password: gymOwnerPassword,
    role: "gym_owner",
    firstName: "Marcus",
    lastName: "Johnson",
    phone: "+1 555-0111",
    isActive: true,
  });

  const trainerPassword = await bcrypt.hash("trainer123", 10);
  await storage.createUser({
    tenantId: tenant1.id,
    username: "trainer1",
    email: "sarah@irontemple.com",
    password: trainerPassword,
    role: "trainer",
    firstName: "Sarah",
    lastName: "Mitchell",
    phone: "+1 555-0112",
    isActive: true,
  });

  await storage.createUser({
    tenantId: tenant1.id,
    username: "trainer2",
    email: "mike@irontemple.com",
    password: trainerPassword,
    role: "trainer",
    firstName: "Mike",
    lastName: "Rodriguez",
    phone: "+1 555-0113",
    isActive: true,
  });

  await storage.createUser({
    tenantId: tenant1.id,
    username: "trainer3",
    email: "emma@irontemple.com",
    password: trainerPassword,
    role: "trainer",
    firstName: "Emma",
    lastName: "Chen",
    phone: "+1 555-0114",
    isActive: true,
  });

  const now = new Date();
  const seedMembers = [
    { firstName: "Alex", lastName: "Rivera", email: "alex.r@email.com", phone: "+1 555-1001", membershipType: "annual", status: "active", daysOffset: -120 },
    { firstName: "Jessica", lastName: "Park", email: "jess.park@email.com", phone: "+1 555-1002", membershipType: "monthly", status: "active", daysOffset: -15 },
    { firstName: "David", lastName: "Thompson", email: "d.thompson@email.com", phone: "+1 555-1003", membershipType: "quarterly", status: "active", daysOffset: -45 },
    { firstName: "Maria", lastName: "Garcia", email: "maria.g@email.com", phone: "+1 555-1004", membershipType: "monthly", status: "active", daysOffset: -25 },
    { firstName: "James", lastName: "Wilson", email: "j.wilson@email.com", phone: "+1 555-1005", membershipType: "annual", status: "active", daysOffset: -200 },
    { firstName: "Olivia", lastName: "Brown", email: "olivia.b@email.com", phone: "+1 555-1006", membershipType: "monthly", status: "expired", daysOffset: -40 },
    { firstName: "Ethan", lastName: "Lee", email: "ethan.lee@email.com", phone: "+1 555-1007", membershipType: "quarterly", status: "active", daysOffset: -60 },
    { firstName: "Sophia", lastName: "Martinez", email: "sophia.m@email.com", phone: "+1 555-1008", membershipType: "monthly", status: "frozen", daysOffset: -10 },
    { firstName: "Ryan", lastName: "Taylor", email: "ryan.t@email.com", phone: "+1 555-1009", membershipType: "annual", status: "active", daysOffset: -300 },
    { firstName: "Chloe", lastName: "Anderson", email: "chloe.a@email.com", phone: "+1 555-1010", membershipType: "monthly", status: "active", daysOffset: -5 },
    { firstName: "Daniel", lastName: "White", email: "d.white@email.com", phone: "+1 555-1011", membershipType: "quarterly", status: "active", daysOffset: -80 },
    { firstName: "Lily", lastName: "Thomas", email: "lily.t@email.com", phone: "+1 555-1012", membershipType: "monthly", status: "active", daysOffset: -3 },
  ];

  for (const m of seedMembers) {
    const start = new Date(now.getTime() + m.daysOffset * 24 * 60 * 60 * 1000);
    let endOffset: number;
    switch (m.membershipType) {
      case "annual": endOffset = 365; break;
      case "quarterly": endOffset = 90; break;
      default: endOffset = 30;
    }
    const end = new Date(start.getTime() + endOffset * 24 * 60 * 60 * 1000);

    await storage.createMember({
      tenantId: tenant1.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      membershipType: m.membershipType,
      membershipStart: start,
      membershipEnd: end,
      status: m.status,
    });
  }

  const activityItems = [
    { type: "member_added", description: "Chloe Anderson joined as a new monthly member" },
    { type: "member_added", description: "Lily Thomas signed up for a monthly membership" },
    { type: "member_renewed", description: "James Wilson renewed their annual membership" },
    { type: "check_in", description: "Alex Rivera checked in at 7:30 AM" },
    { type: "payment", description: "Monthly payment received from Jessica Park - $49.00" },
    { type: "member_added", description: "Daniel White enrolled in quarterly membership" },
    { type: "check_in", description: "David Thompson checked in at 6:15 AM" },
  ];

  for (const a of activityItems) {
    await storage.createActivity({
      tenantId: tenant1.id,
      type: a.type,
      description: a.description,
    });
  }

  await storage.createBranch({
    tenantId: tenant1.id,
    name: "Main Branch",
    address: "123 Iron Street, Los Angeles, CA 90001",
    phone: "+1 555-0101",
    email: "main@irontemple.com",
    isActive: true,
  });

  await storage.createBranch({
    tenantId: tenant1.id,
    name: "Downtown Branch",
    address: "500 Fitness Ave, Los Angeles, CA 90012",
    phone: "+1 555-0115",
    email: "downtown@irontemple.com",
    isActive: true,
  });

  const seedEquipment = [
    { name: "Treadmill Pro X1", category: "Cardio", sku: "TRD-001", quantity: 8, minStock: 2, costPrice: "1200.00", sellPrice: "1800.00" },
    { name: "Adjustable Dumbbells 5-50lb", category: "Strength", sku: "DUM-001", quantity: 20, minStock: 5, costPrice: "250.00", sellPrice: "399.00" },
    { name: "Resistance Bands Set", category: "Accessories", sku: "ACC-001", quantity: 30, minStock: 10, costPrice: "12.00", sellPrice: "29.99" },
    { name: "Whey Protein 2lb", category: "Supplements", sku: "SUP-001", quantity: 15, minStock: 5, costPrice: "22.00", sellPrice: "39.99" },
    { name: "Yoga Mat Premium", category: "Accessories", sku: "ACC-002", quantity: 25, minStock: 8, costPrice: "15.00", sellPrice: "34.99" },
    { name: "Stationary Bike V2", category: "Cardio", sku: "BIK-001", quantity: 1, minStock: 2, costPrice: "800.00", sellPrice: "1299.00" },
  ];
  for (const e of seedEquipment) {
    await storage.createEquipment({ ...e, tenantId: tenant1.id });
  }

  await storage.createSupplier({
    tenantId: tenant1.id,
    name: "FitPro Supplies",
    contactPerson: "John Baker",
    email: "john@fitpro.com",
    phone: "+971 4 555 9001",
    address: "Al Quoz Industrial Area, Dubai, UAE",
    taxNumber: "100234567890003",
    isActive: true,
  });

  await storage.createSupplier({
    tenantId: tenant1.id,
    name: "MuscleTech Equipment",
    contactPerson: "Lisa Wong",
    email: "lisa@muscletech.com",
    phone: "+971 4 555 9002",
    address: "Dubai Investment Park, Dubai, UAE",
    taxNumber: "100567890123004",
    isActive: true,
  });

  console.log("Database seeded successfully!");
}
