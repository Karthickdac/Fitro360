# Fitro360 - Multi-Tenant Gym Management SaaS

## Overview
Fitro360 is a multi-tenant SaaS platform for gym management. It supports multiple gym tenants with custom branding, role-based access control, member management, trainer scheduling, equipment ERP, multi-branch support, and platform-level administration.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, shadcn/ui, Recharts, wouter routing
- **Backend**: Node.js + Express, PostgreSQL, Drizzle ORM
- **Auth**: Session-based with bcryptjs password hashing
- **State**: TanStack React Query

## Architecture
- Multi-tenant with data isolation via `tenantId` foreign keys
- Role-based access: `platform_admin`, `gym_owner`, `manager`, `trainer`, `member`, `sales_executive`
- Tenant branding stored per tenant (colors, logo, name) - auto-applies CSS variables on login
- Role-based routing: separate routers per role (AdminRouter, MemberRouter, TrainerRouter, ManagerRouter, GymOwnerRouter)
- Sidebar navigation adapts to user role (members see portal, trainers see workspace, owners see full admin)

## Database Tables
- `tenants` - Gym organizations with branding config (primaryColor, secondaryColor, domain, subdomain, faviconUrl, emailTemplateBg, emailTemplateAccent, smsSenderId, invoiceHeader, invoiceFooter, market)
- `users` - All users across tenants with role-based access
- `members` - Gym members with BMI tracking (height, weight, bmi) + trainer assignment (trainerId) + membershipPlanId
- `membership_plans` - Gym-specific membership plans per tenant (name, durationType, durationDays, price, currency, setupFee, features, perks, color, isPopular, isActive, sortOrder)
- `member_metrics` - Historical progress tracking (weight, BMI, body fat over time)
- `subscription_plans` - SaaS pricing tiers (basic/pro/enterprise)
- `activities` - Activity log per tenant
- `branches` - Multi-branch support per tenant
- `trainer_sessions` - Trainer scheduling with conflict detection + drag-drop rescheduling
- `attendance` - Member check-in/check-out tracking (supports QR code method)
- `equipment` - Equipment inventory with stock management
- `equipment_maintenance` - Maintenance scheduling with status/cost tracking
- `suppliers` - Supplier management with GST numbers
- `invoices` - Invoice management with GST calculations
- `payment_records` - Payment tracking with method/status + Stripe integration (stripePaymentId)
- `notifications` - In-app/SMS/email notification system
- `coupons` - Promotional coupon codes
- `referrals` - Member referral program tracking
- `trainer_profiles` - Extended trainer profiles (bio, specializations, certifications, experienceYears, hourlyRate, availability, socialLinks)
- `trainer_commissions` - Trainer commission tracking (session/bonus/referral, pending/paid)
- `trainer_leaves` - Trainer leave requests with approval workflow

## Project Structure
```
client/src/
  App.tsx             - Main app with role-based routing
  lib/auth.tsx        - Auth context with tenant branding
  lib/queryClient.ts  - API client + React Query config
  components/         - Shared components (sidebar, stat-card, theme)
  pages/
    login.tsx         - Login page
    dashboard.tsx     - Gym owner dashboard
    membership-plans.tsx - Comprehensive membership plan management (CRUD, perks, features, pricing)
    members.tsx       - Member CRUD with BMI, freeze/renew, export
    member-detail.tsx - Member detail with progress charts, metrics history
    member-portal.tsx - Member self-service portal (attendance, profile, sessions)
    trainer-portal.tsx - Trainer workspace (my schedule, my members)
    trainers.tsx      - Trainer listing
    schedule.tsx      - Trainer calendar/scheduling (weekly view) with drag-drop rescheduling
    check-in.tsx      - Attendance check-in/check-out with QR code support
    inventory.tsx     - Equipment inventory management
    maintenance.tsx   - Equipment maintenance scheduling with overdue alerts
    suppliers.tsx     - Supplier management
    invoicing.tsx     - Invoice management with GST
    trainers.tsx      - Full trainer CRUD with profiles (add/edit/view/deactivate, specializations, certifications)
    trainer-management.tsx - Trainer commissions, leaves, performance analytics (3 tabs)
    payments.tsx      - Payment records with revenue stats + Stripe checkout
    analytics.tsx     - Analytics dashboard with 6 Recharts visualizations
    branches.tsx      - Multi-branch management
    notifications.tsx - Notification center with tabs
    coupons.tsx       - Coupon/promotion management
    referrals.tsx     - Referral program management
    activity.tsx      - Activity log
    settings.tsx      - Tenant branding settings (4 cards: Gym Info, Branding, Advanced Branding, Email Template)
    admin/            - Platform admin pages
      dashboard.tsx   - Platform overview
      tenants.tsx     - Full tenant CRUD (add/edit/delete, subdomain, detail view with users)
      plans.tsx       - Subscription plans
      settings.tsx    - Platform settings (domain config, security, markets)
server/
  index.ts            - Express server entry
  db.ts               - Database connection
  routes.ts           - API routes with auth middleware
  storage.ts          - Database operations interface
  seed.ts             - Seed data for demo
shared/
  schema.ts           - Drizzle schema + Zod validators
```

## Demo Credentials
- Platform Admin: admin / admin123
- Gym Owner: gymowner / gym123
- Trainer: trainer1 / trainer123
- Member: member1 / member123

## Running
- `npm run dev` - Start dev server (port 5000)
- `npm run db:push` - Push schema to database
