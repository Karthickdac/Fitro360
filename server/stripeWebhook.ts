import type { Request, Response } from "express";
import { storage } from "./storage";
import {
  getUncachableStripeClient,
  getStripeSync,
  getWebhookSecret,
} from "./stripeClient";

const GRACE_PERIOD_DAYS = 3;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function findTenantByCustomerId(customerId: string) {
  return await storage.getTenantByStripeCustomerId(customerId);
}

async function handleSubscriptionEvent(subscription: any) {
  if (!subscription.customer) return;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) {
    console.warn(`[stripe] No tenant found for customer ${customerId}`);
    return;
  }

  const status = subscription.status as string;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : subscription.items?.data?.[0]?.current_period_end
      ? new Date(subscription.items.data[0].current_period_end * 1000)
      : null;
  const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
  const interval =
    subscription.items?.data?.[0]?.price?.recurring?.interval === "year"
      ? "annual"
      : "monthly";

  // Map plan
  const priceId = subscription.items?.data?.[0]?.price?.id;
  let subscriptionPlan = tenant.subscriptionPlan;
  if (priceId) {
    const matchingPlan = await storage.getPlanByStripePriceId(priceId);
    if (matchingPlan) subscriptionPlan = matchingPlan.name.toLowerCase();
  }

  const update: any = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionInterval: interval,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    subscriptionPlan,
  };

  if (status === "active" || status === "trialing") {
    update.gracePeriodEndsAt = null;
    update.isActive = true;
  } else if (status === "past_due" || status === "unpaid") {
    if (!tenant.gracePeriodEndsAt) {
      update.gracePeriodEndsAt = addDays(new Date(), GRACE_PERIOD_DAYS);
    }
  } else if (status === "canceled" || status === "incomplete_expired") {
    update.gracePeriodEndsAt = null;
    update.isActive = false;
  }

  await storage.updateTenant(tenant.id, update);
  console.log(
    `[stripe] tenant ${tenant.id} -> ${status} (plan ${subscriptionPlan})`,
  );
}

async function handleInvoicePaid(invoice: any) {
  if (!invoice.customer) return;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;
  await storage.updateTenant(tenant.id, {
    subscriptionStatus: "active",
    gracePeriodEndsAt: null,
    isActive: true,
  });
  console.log(`[stripe] invoice paid for tenant ${tenant.id}`);
}

async function handleInvoiceFailed(invoice: any) {
  if (!invoice.customer) return;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer.id;
  const tenant = await findTenantByCustomerId(customerId);
  if (!tenant) return;
  const grace = tenant.gracePeriodEndsAt || addDays(new Date(), GRACE_PERIOD_DAYS);
  await storage.updateTenant(tenant.id, {
    subscriptionStatus: "past_due",
    gracePeriodEndsAt: grace,
  });
  console.log(
    `[stripe] invoice failed for tenant ${tenant.id}; grace ends ${grace.toISOString()}`,
  );
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  const secret = getWebhookSecret();
  if (!secret) {
    return res.status(503).json({ error: "Stripe not initialized" });
  }

  const rawBody = req.body as Buffer;

  let event: any;
  try {
    const stripe = await getUncachableStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err: any) {
    console.error("[stripe] signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Idempotency: skip events we've already processed.
  // Stripe retries deliveries; without this, late retries can clobber newer state.
  try {
    if (await storage.isStripeEventProcessed(event.id)) {
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (err: any) {
    console.warn("[stripe] idempotency check failed:", err.message);
  }

  // Let stripe-replit-sync mirror the event into the local stripe.* schema
  try {
    const sync = await getStripeSync();
    await sync.processWebhook(rawBody, signature);
  } catch (err: any) {
    console.error("[stripe] sync.processWebhook error:", err.message);
  }

  // Application-level reactions
  let handlerOk = true;
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await handleSubscriptionEvent(event.data.object);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err: any) {
    handlerOk = false;
    console.error(`[stripe] handler error for ${event.type}:`, err.message);
  }

  // Mark as processed only on success so Stripe will retry on errors
  if (handlerOk) {
    try {
      await storage.markStripeEventProcessed(event.id, event.type);
    } catch (err: any) {
      console.warn("[stripe] markProcessed failed:", err.message);
    }
  }

  // Always 200 so Stripe stops retrying for poison messages; but if handler failed
  // we return 500 to trigger a retry (Stripe respects 5xx for redelivery).
  return res.status(handlerOk ? 200 : 500).json({ received: handlerOk });
}

// Sweep tenants whose grace period has expired and suspend them.
export async function suspendExpiredGraceTenants() {
  try {
    const tenants = await storage.getTenantsWithExpiredGrace(new Date());
    for (const t of tenants) {
      await storage.updateTenant(t.id, { isActive: false });
      console.log(`[stripe] suspending tenant ${t.id} (grace expired)`);
    }
  } catch (err: any) {
    console.error("[stripe] grace sweep error:", err.message);
  }
}
