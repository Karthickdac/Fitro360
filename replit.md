# Fitro360 - White-Label Multi-Tenant Gym Management SaaS

## Overview
Fitro360 is a white-label, multi-tenant SaaS platform for gym management. It supports multiple gym tenants with custom branding, role-based access control, member management, trainer scheduling, equipment ERP, multi-branch support, and platform-level administration.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, shadcn/ui, Recharts, wouter routing
- **Backend**: Node.js + Express, PostgreSQL, Drizzle ORM
- **Auth**: Session-based with bcryptjs password hashing
- **State**: TanStack React Query

## Architecture
- Multi-tenant with data isolation via `tenantId` foreign keys
- Role-based access: `platform_admin`, `gym_owner`, `manager`, `trainer`, `member`, `sales_executive`
- White-label branding stored per tenant (colors, logo, name)
- Sidebar navigation organized into 4 groups: Gym Management, Equipment & Sales, Marketing, System

## Database Tables
- `tenants` - Gym organizations with branding config
- `users` - All users across tenants with role-based access
- `members` - Gym members with BMI tracking (height, weight, bmi)
- `subscription_plans` - SaaS pricing tiers (basic/pro/enterprise)
- `activities` - Activity log per tenant
- `branches` - Multi-branch support per tenant
- `trainer_sessions` - Trainer scheduling with conflict detection
- `attendance` - Member check-in/check-out tracking
- `equipment` - Equipment inventory with stock management
- `suppliers` - Supplier management with GST numbers
- `invoices` - Invoice management with GST calculations
- `notifications` - In-app/SMS/email notification system
- `coupons` - Promotional coupon codes
- `referrals` - Member referral program tracking

## Project Structure
```
client/src/
  App.tsx             - Main app with auth routing
  lib/auth.tsx        - Auth context provider
  lib/queryClient.ts  - API client + React Query config
  components/         - Shared components (sidebar, stat-card, theme)
  pages/
    login.tsx         - Login page
    dashboard.tsx     - Gym owner dashboard
    members.tsx       - Member CRUD with BMI, freeze/renew, export
    trainers.tsx      - Trainer listing
    schedule.tsx      - Trainer calendar/scheduling (weekly view)
    check-in.tsx      - Attendance check-in/check-out
    inventory.tsx     - Equipment inventory management
    suppliers.tsx     - Supplier management
    invoicing.tsx     - Invoice management with GST
    branches.tsx      - Multi-branch management
    notifications.tsx - Notification center with tabs
    coupons.tsx       - Coupon/promotion management
    referrals.tsx     - Referral program management
    activity.tsx      - Activity log
    settings.tsx      - Tenant branding settings
    admin/            - Platform admin pages
      dashboard.tsx   - Platform overview
      tenants.tsx     - Tenant CRUD
      plans.tsx       - Subscription plans
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

## Running
- `npm run dev` - Start dev server (port 5000)
- `npm run db:push` - Push schema to database
