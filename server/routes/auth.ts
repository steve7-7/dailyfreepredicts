import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, RequestHandler, Response } from "express";
import { SubscriptionVerifyResponse, UserAuthResponse } from "@shared/api";

const SUBSCRIPTION_URL = "https://paystack.com/buy/today-predictions-vbmpjc";
const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = Number(
  process.env.SUBSCRIPTION_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000,
);

interface SubscriptionTokenPayload {
  version: number;
  userId: string;
  email?: string;
  paystackReference: string;
  issuedAt: number;
  expiresAt: number;
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    customer?: {
      email?: string;
      customer_code?: string;
    };
  };
}

function getSubscriptionToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() || undefined;
}

function getTokenSecret(): string | undefined {
  return (
    process.env.SUBSCRIPTION_TOKEN_SECRET || process.env.PAYSTACK_SECRET_KEY
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function createSubscriptionToken(payload: SubscriptionTokenPayload): string {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error(
      "SUBSCRIPTION_TOKEN_SECRET or PAYSTACK_SECRET_KEY is required to issue access tokens",
    );
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifySubscriptionToken(
  token: string,
): SubscriptionTokenPayload | undefined {
  const secret = getTokenSecret();
  if (!secret) {
    return undefined;
  }

  const [encodedPayload, signature, ...extraParts] = token.split(".");
  if (!encodedPayload || !signature || extraParts.length > 0) {
    return undefined;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as SubscriptionTokenPayload;
    if (
      payload.version !== TOKEN_VERSION ||
      !payload.userId ||
      !payload.paystackReference ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return undefined;
    }

    return payload;
  } catch {
    return undefined;
  }
}

function getActiveSubscription(
  req: Request,
): SubscriptionTokenPayload | undefined {
  const token = getSubscriptionToken(req);
  return token ? verifySubscriptionToken(token) : undefined;
}

export function hasActiveSubscription(req: Request): boolean {
  return !!getActiveSubscription(req);
}

export function requireActiveSubscription(
  req: Request,
  res: Response,
): boolean {
  if (hasActiveSubscription(req)) {
    return true;
  }

  res.status(401).json({
    error: "Subscription required",
    subscriptionUrl: SUBSCRIPTION_URL,
  });
  return false;
}

async function verifyPaystackReference(
  reference: string,
): Promise<SubscriptionTokenPayload> {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecretKey) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is required to verify subscription payments",
    );
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    },
  );

  const result = (await response.json()) as PaystackVerifyResponse;
  if (!response.ok || !result.status || result.data?.status !== "success") {
    throw new Error(result.message || "Payment verification failed");
  }

  const expectedCurrency = process.env.PAYSTACK_CURRENCY;
  if (expectedCurrency && result.data.currency !== expectedCurrency) {
    throw new Error(
      "Payment currency does not match the configured subscription currency",
    );
  }

  const expectedAmount = Number(process.env.PAYSTACK_EXPECTED_AMOUNT_KOBO || 0);
  if (expectedAmount > 0 && result.data.amount !== expectedAmount) {
    throw new Error(
      "Payment amount does not match the configured subscription price",
    );
  }

  const now = Date.now();
  const customerCode = result.data.customer?.customer_code;
  const email = result.data.customer?.email;

  return {
    version: TOKEN_VERSION,
    userId: customerCode || email || result.data.reference || reference,
    email,
    paystackReference: result.data.reference || reference,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
}

export const handleCheckAuth: RequestHandler = (req, res) => {
  const subscription = getActiveSubscription(req);

  const response: UserAuthResponse = {
    isSubscribed: !!subscription,
    userId: subscription?.userId,
    email: subscription?.email,
  };

  res.json(response);
};

export const handleVerifySubscription: RequestHandler = async (req, res) => {
  const reference =
    typeof req.body?.reference === "string" ? req.body.reference.trim() : "";
  if (!reference) {
    res.status(400).json({ error: "Payment reference is required" });
    return;
  }

  try {
    const subscription = await verifyPaystackReference(reference);
    const response: SubscriptionVerifyResponse = {
      token: createSubscriptionToken(subscription),
      isSubscribed: true,
      userId: subscription.userId,
      email: subscription.email,
      expiresAt: new Date(subscription.expiresAt).toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error("Error verifying Paystack subscription:", error);
    res.status(401).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify subscription payment",
    });
  }
};
