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
- **Premium theme**: deep violet-black sidebar (HSL 250 22% 8%) + electric violet accent (HSL 263 75% 66%) for active items, with left-edge violet accent bar and soft glow. Logo uses violet gradient with sparkle. Footer has online status dot.
- **Collapsible sidebar**: shadcn `collapsible="icon"` mode — toggle via the trigger button in the top header or the keyboard shortcut Cmd/Ctrl+B. Icons remain visible when collapsed and show tooltips on hover.
- **Enterprise sidebar groups** (gym_owner): Overview · Membership · Staff · Operations · Procurement · Finance · Tax & Compliance · Growth · Reports · System (10 sections)

## Biometric Access Control (Phase A + B/C)
- **Goal**: integrate face / fingerprint / RFID gym-entry hardware (ZKTeco, ESSL, Hikvision, Suprema, Matrix, Anviz, Realtime, Dahua, IDEMIA, Virdi, HID) so a member's enrolment in Fitro360 instantly unlocks the door and writes attendance.
- **Architecture**: brand-agnostic adapter pattern — `server/biometric/types.ts` defines `DeviceAdapter`; `server/biometric/registry.ts` maps `Device.brand` → adapter at runtime. `server/biometric/access-engine.ts` contains the single source of truth for "should this member be allowed in?" — reads only the local DB so a Stripe outage cannot lock members out.
- **Adapters shipped**: VERIFIED — ZKTeco (ADMS push), ESSL (ADMS alias), Realtime (ADMS-compatible), Hikvision (ISAPI HTTP listening — JSON **and** multipart/form-data with JSON event_log + image parts). UNTESTED scaffolds (wired through registry, surfaced with yellow badge): Suprema BioStar 2, Matrix COSEC, Anviz CrossChex, Dahua DSS. Planned (not yet coded): IDEMIA, Virdi, HID.
- **Tables**: `devices`, `biometric_templates`, `access_events`, `door_commands`, `processed_biometric_events` (Phase A) PLUS `access_block_rules` (owner-defined custom blocks: ruleType ∈ {plan, membership_type, status, nationality, day_of_week, time_window}, ruleValue csv, branchId nullable, priority asc), `tenant_biometric_settings` (templateRetentionMonths default 24, eventRetentionMonths default 12, purgeOnCancellation, relayWsEnabled), `unmatched_enrolments` (templates seen on a device but not yet linked to a Fitro360 member).
- **Access decision pipeline** (in priority order): cross-tenant defence → tenant.isActive → status (frozen/cancelled/inactive/transferred/expired) → membershipEnd date → device-branch match → plan-level branch allowlist → liability waiver signed → unpaid invoice (member-scoped indexed query, 7-day grace) → owner-defined custom block rules. Custom rules are pure-function evaluated (`matchAnyBlockRule`) so unit-tests can drive them without DB.
- **WebSocket live feed**: `/ws/access-events` mounted on the same httpServer. Auth: re-reads the express-session signed cookie via `cookie-signature.unsign` against the shared MemoryStore stashed at `app._sessionStore`. Owner+manager only. Frames: `{type:"hello"}`, `{type:"access_event", event}` (rawPayload + photoUrl stripped), `{type:"device_status", deviceId, status}`. 30s heartbeat ping/pong drops half-closed sockets.
- **Background workers** (started in `server/index.ts`): `startRetentionSweeper` runs daily — (a) hard-deletes biometric_templates whose owning member has been `inactive`/`transferred`/`cancelled` for more than 30 days (or immediately if tenant has `purgeOnCancellation`), pushing a `deleteTemplate` command through the brand adapter so the device forgets the user too; (b) wipes `rawPayload` and `photoUrl` from access_events older than `eventRetentionMonths` while keeping decision/reason/timestamp metadata for audit (`storage.wipeAccessEventPayloadsOlderThan`); (c) deletes unmatched_enrolments older than 90 days; writes a `biometric_retention_sweep` activity row per tenant for compliance evidence. `startEnrolmentSync` runs every 60s — for adapters that implement `listEnrolled`, pulls device-side templates and writes new ones into `unmatched_enrolments` for staff review.
- **Webhook ingress**: `/api/biometric/{brand}/webhook` (and `/iclock/*` for ADMS firmware). Verifies HMAC of raw body against device.secret. Hikvision route now uses `rawTextParser` so multipart bodies arrive intact. Looks up member via `resolveMemberFromExternalRef`, runs `evaluateAccess`, records access event, on allow writes attendance + queues door open + broadcasts via `broadcastAccessEvent`.
- **Door open idempotency**: `dev:{deviceId}:door:{floor(now/3000)}` — multiple triggers within the same 3-second bucket collapse to one queued command.
- **Pages**: `/devices` (CRUD; reveals secret once on create), `/enrolment` (webcam capture + multi-device push + GDPR consent), `/access-events` (live WS feed with status indicator, filters: decision, device, member, from, to), `/access-block-rules` (owner CRUD: name, ruleType, ruleValue csv, branchId optional, reason, priority, isActive). Member portal: `/portal/entries`.
- **RBAC**: gym_owner+manager exclusively manage devices/enrolment/block-rules/settings, view tenant-wide access events, trigger manual door-open. sales_executive and trainer have NO biometric admin access. Members may only see their own templates and entry history.
- **API surface added**: GET/POST/PATCH/DELETE `/api/biometric/block-rules`, GET/PATCH `/api/biometric/settings`, GET/PATCH/DELETE `/api/biometric/unmatched`, POST `/api/biometric/retention/run`, POST `/api/biometric/enrolment-sync/run`, GET `/api/access-events?decision=&deviceId=&memberId=&from=&to=&limit=`.
- **Test coverage**: `npx vitest run` — 36 tests across `tests/biometric/{access-engine,adapters,access-pipeline}.test.ts`. Covers full decision matrix (21 cases), pure rule-matcher edge cases (priority, time-window wrap-past-midnight, branch scoping), ZKTeco ATTLOG parsing + HMAC + pwd fallback, Hikvision JSON + multipart parsing, dedupe via `claimBiometricEvent`, door-command idempotency, retention sweep, unmatched-enrolment upsert.
- **Deferred (follow-up tasks)**: on-prem relay agent distributable (#2); IDEMIA/Virdi/HID adapters + per-brand hardware-in-the-loop verification of the four UNTESTED scaffolds (#3); staff biometric clock-in (#4 — retention/rules/multipart/ws/scoped-invoice/sync now SHIPPED; only staff clock-in remains under that ref).
- **ADMS auth compatibility note**: `/iclock/*` ADMS endpoints accept `?pwd=<device.secret>` bearer auth in addition to the preferred X-Fitro360-Sig HMAC, because stock ZKTeco/ESSL/Realtime firmware cannot send custom headers. Mitigations: per-device secret rotation, TLS-only transport, `device.secret` is in SENSITIVE_KEYS so it is redacted in logs and stripped from list APIs, and every ADMS request additionally requires a registered brand+serial+isActive device row.

## Database Tables
- `fixed_assets` - Fixed Asset Register: name, assetCode, category (equipment/furniture/electronics/vehicle/building/other), location, vendorName/Contact, purchaseDate, purchaseValue, warrantyExpiry, amcExpiry, serialNumber, status (active/maintenance/retired/disposed), branchId, depreciation tracking
- `membership_transfers` - Member-to-member transfer requests: fromMemberId, toMemberId, membershipPlanId, transferDate, reason, status (pending/approved/rejected), approvedBy, fee, remainingDays, notes. Approval swaps the source member's plan onto the destination and marks the source "transferred"
- `tenants` - Gym organizations with branding config (primaryColor, secondaryColor, domain, subdomain, faviconUrl, emailTemplateBg, emailTemplateAccent, smsSenderId, invoiceHeader, invoiceFooter, market) + tax fields (legalName, tradeLicenseNumber, trn, vatRegisteredOn, vatFilingFrequency, ctTrn, ctRegisteredOn, fyStartMonth)
- `supplier_bills` - Purchase invoices used for input VAT recovery and CT expense deduction (supplierId, billNumber, billDate, category, subtotal, vatRate, vatAmount, total, vatTreatment, isDeductible, status)
- `vat_returns` - VAT 201 returns with FTA boxes (1a standard sales/VAT, 2 zero-rated, 3 exempt, 4 reverse charge, 6 imports, 9 standard purchases/input VAT, totals, netVatPayable, status: draft/filed/paid)
- `corporate_tax_returns` - UAE Corporate Tax filings (fyStart/End, totalRevenue, totalExpenses, accountingProfit, addBacks, exemptIncome, reliefClaimed, smallBusinessRelief, taxableIncome, threshold 375000, taxRate 9%, taxDue)
- `users` - All users across tenants with role-based access
- `members` - Gym members with BMI tracking (height, weight, bmi) + trainer assignment (trainerId) + membershipPlanId + nationality, dateOfBirth, salespersonId, emergencyContactName, emergencyContactRelation, signatureDataUrl (base64 PNG), waiverAcceptedAt (paperless onboarding)
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
    members.tsx       - Member CRUD with BMI, freeze/renew, export. Plan column shows actual plan name (joined via membershipPlanId). Rows are clickable → /members/:id. Add form includes nationality, DOB, salesperson, emergency contact (name/phone/relation), inline HTML5 signature pad + waiver checkbox (paperless onboarding)
    member-detail.tsx - Member detail with progress charts, metrics history
    fixed-assets.tsx  - Fixed Asset Register (CRUD) with vendor, warranty/AMC expiry alerts, category badges
    membership-transfers.tsx - Member-to-member transfer requests with approve/reject workflow (gym_owner approval)
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
    tax-settings.tsx  - UAE tax registration (TRN, VAT cadence, CT TRN, FY start month)
    supplier-bills.tsx - Purchase invoices for input VAT recovery & CT expense deduction
    vat-returns.tsx   - VAT 201 preparation: auto-compute boxes 1a/2/3/9, file with FTA reference, mark paid
    corporate-tax.tsx - Corporate Tax filing: revenue/expense compute, adjustments, 9% above 375k, small business relief
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

## Real-time Dashboard
- Hero label "Live view — auto-refreshes every 30 seconds." Stats refetch every 30s; alerts refetch every 60s.
- Top KPI row (4 tiles): Total Members, Active Members, Monthly Revenue, Expiring Soon.
- "Today's Snapshot" row (5 tiles): Per Day Sales, Cash Sales, Credit Sales, Birthdays Today, Today's Expiry. Sourced from `/api/dashboard/sales-today` (sums `payment_records` for today by method) and `/api/dashboard/alerts` (members with DOB month/day == today and members with `membershipEnd` within 7 days).
- Alerts panel row (3 cards): Birthdays Today list, Expiring Soon (7d) list (clickable → member detail), Membership Status pie chart.
- Old "Revenue Overview" bar chart removed.

## Paperless Onboarding
- The Add Member dialog includes an inline HTML5 canvas signature pad (`SignaturePad` component in `members.tsx`). Drawn signature is captured as a base64 PNG data URL and stored in `members.signatureDataUrl`.
- Waiver acceptance is a checkbox; when checked, the server stamps `members.waiverAcceptedAt = now`.

## Demo Credentials
- Platform Admin: admin / admin123
- Gym Owner: gymowner / gym123
- Manager: manager1 / manager123
- Trainer: trainer1 / trainer123
- Member: member1 / member123

## Running
- `npm run dev` - Start dev server (port 5000)
- `npm run db:push` - Push schema to database

## VPS Deployment (www.fitro360.com)
- **Host**: srv1286649 (shared VPS with kyro360)
- **Path**: `/home/fitro360/htdocs/www.fitro360.com/fitro360`
- **Port**: 4000 (Nginx proxies fitro360.com → localhost:4000)
- **Database**: `postgresql://fitro360user:Fitro%40957823@127.0.0.1:5432/fitro360`
- **Process Manager**: PM2 (name: "fitro360")
- **IMPORTANT**: Kyro360 runs on port 5000 on the same VPS. Never use port 5000 for fitro360.
- **Schema updates**: After schema changes, must run `DATABASE_URL="..." npm run db:push` on VPS, then `pm2 restart fitro360`
- **Starting**: `PORT=4000 DATABASE_URL="..." SESSION_SECRET="..." NODE_ENV=production pm2 start npm --name "fitro360" -- start`
- **Nginx config**: `/etc/nginx/sites-available/fitro360`
- **Kyro360 Nginx config**: `/etc/nginx/sites-available/kyro360.conf`
