import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { handleStripeWebhook, suspendExpiredGraceTenants } from "./stripeWebhook";
import {
  getStripeSync,
  setWebhookSecret,
  setStripeReady,
} from "./stripeClient";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Stripe webhook MUST be registered before express.json() so the body stays raw
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Recursively scrub sensitive keys before they hit logs. Keep this list in
// sync with any new high-value fields (device.secret, biometric template data,
// encrypted device passwords, etc.).
const SENSITIVE_KEYS = new Set([
  "secret",
  "passwordEnc",
  "password",
  "templateData",
  "rawPayload",
  "signatureDataUrl",
  "imagePreviewUrl",
  "photoUrl",
]);
function redactSensitive(value: any): any {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redactSensitive(v);
    }
    return out;
  }
  return value;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Redact sensitive fields (device shared secrets, biometric template
        // bytes, encrypted device passwords, raw event payloads) so they
        // never land in plaintext server logs.
        const redacted = redactSensitive(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(redacted)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function initStripe() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      log("Stripe init skipped: DATABASE_URL missing", "stripe");
      return;
    }

    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const baseUrl = process.env.REPLIT_DEPLOYMENT === "1"
      ? `https://${(process.env.REPLIT_DOMAINS || "").split(",")[0]}`
      : `https://${(process.env.REPLIT_DEV_DOMAIN || (process.env.REPLIT_DOMAINS || "").split(",")[0])}`;

    if (!baseUrl || baseUrl === "https://") {
      log("Stripe init skipped: no public domain available", "stripe");
      return;
    }

    const { webhook } = await stripeSync.findOrCreateManagedWebhook(
      `${baseUrl}/api/stripe/webhook`,
    );
    if (webhook?.secret) setWebhookSecret(webhook.secret);

    // Backfill in the background so startup is not blocked
    stripeSync
      .syncBackfill()
      .then(() => log("Stripe backfill complete", "stripe"))
      .catch((e: any) => log(`Stripe backfill error: ${e.message}`, "stripe"));

    setStripeReady(true);
    log(`Stripe initialized; webhook ${baseUrl}/api/stripe/webhook`, "stripe");
  } catch (err: any) {
    log(`Stripe init failed: ${err.message}`, "stripe");
  }
}

(async () => {
  const { seedDatabase } = await import("./seed");
  try {
    await seedDatabase();
  } catch (e) {
    console.error("Seed error:", e);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Kick Stripe initialization off in the background after the server is listening
      initStripe();
      // Sweep for expired grace periods every 6 hours
      setInterval(suspendExpiredGraceTenants, 6 * 60 * 60 * 1000);
    },
  );
})();
