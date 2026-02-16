# Fitro360 - White-Label Multi-Tenant Gym Management SaaS

## Overview
Fitro360 is a white-label, multi-tenant SaaS platform for gym management. It supports multiple gym tenants with custom branding, role-based access control, member management, trainer management, and platform-level administration.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, shadcn/ui, Recharts, wouter routing
- **Backend**: Node.js + Express, PostgreSQL, Drizzle ORM
- **Auth**: Session-based with bcryptjs password hashing
- **State**: TanStack React Query

## Architecture
- Multi-tenant with data isolation via `tenantId` foreign keys
- Role-based access: `platform_admin`, `gym_owner`, `manager`, `trainer`, `member`
- White-label branding stored per tenant (colors, logo, name)

## Database Tables
- `tenants` - Gym organizations with branding config
- `users` - All users across tenants with role-based access
- `members` - Gym members belonging to tenants
- `subscription_plans` - SaaS pricing tiers (basic/pro/enterprise)
- `activities` - Activity log per tenant

## Project Structure
```
client/src/
  App.tsx           - Main app with auth routing
  lib/auth.tsx      - Auth context provider
  lib/queryClient.ts- API client + React Query config
  components/       - Shared components (sidebar, stat-card, theme)
  pages/            - Route pages
    login.tsx       - Login page
    dashboard.tsx   - Gym owner dashboard
    members.tsx     - Member CRUD
    trainers.tsx    - Trainer listing
    activity.tsx    - Activity log
    settings.tsx    - Tenant branding settings
    admin/          - Platform admin pages
      dashboard.tsx - Platform overview
      tenants.tsx   - Tenant CRUD
      plans.tsx     - Subscription plans
server/
  index.ts          - Express server entry
  db.ts             - Database connection
  routes.ts         - API routes with auth middleware
  storage.ts        - Database operations interface
  seed.ts           - Seed data for demo
shared/
  schema.ts         - Drizzle schema + Zod validators
```

## Demo Credentials
- Platform Admin: admin / admin123
- Gym Owner: gymowner / gym123
- Trainer: trainer1 / trainer123

## Running
- `npm run dev` - Start dev server (port 5000)
- `npm run db:push` - Push schema to database
