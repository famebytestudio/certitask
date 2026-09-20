import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Safepay Hosted Checkout (sandbox/production) — the only place that knows
 * Safepay's wire format. Verified with real sandbox card payments on 2026-09-20:
 *   POST /order/v1/init   {client, amount (major units), currency, environment} -> data.token (tracker)
 *   Hosted page: {base}/checkout/pay?env&beacon=<tracker>&source=custom&webhooks=true&order_id&redirect_url&cancel_url
 *     On success Safepay sends the browser to redirect_url?order_id=<our payment id>&tracker=<tracker>.
 *   GET  /order/v1/<tracker> -> {state, amount, currency, transaction?}
 *     paid == state "TRACKER_ENDED" with a transaction attached (settled in PKR; amount/currency stay as quoted)
 *   Webhook: header X-SFPY-SIGNATURE = HMAC-SHA512(webhookSecret, raw body) hex
 */

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { amountCents: number; currency: string; orderId: string; description: string; successUrl: string; cancelUrl: string }): Promise<{ ref: string; checkoutUrl: string }>;
  fetchStatus(ref: string): Promise<{ state: string; paid: boolean; capturedCents: number | null; capturedCurrency: string | null; raw: unknown }>;
  verifyWebhook(rawBody: string, signatureHeader: string | null): boolean;
}

function cfg() {
  const base = (process.env.SAFEPAY_BASE_URL || "https://sandbox.api.getsafepay.com").replace(/\/$/, "");
  const env = process.env.SAFEPAY_ENV || "sandbox";
  const publicKey = process.env.SAFEPAY_PUBLIC_KEY;
  const secretKey = process.env.SAFEPAY_SECRET_KEY;
  if (!publicKey || !secretKey) throw new Error("SAFEPAY_PUBLIC_KEY / SAFEPAY_SECRET_KEY are not configured");
  return { base, env, publicKey, secretKey, webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || "" };
}

async function call<T>(path: string, init: RequestInit & { secret: string }): Promise<T> {
  const { secret, ...rest } = init;
  const res = await fetch(cfg().base + path, {
    ...rest,
    headers: { "Content-Type": "application/json", "X-SFPY-MERCHANT-SECRET": secret, ...(rest.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Safepay ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

const PAID_STATE = "TRACKER_ENDED";

export const safepay: PaymentProvider = {
  name: "safepay",

  async createCheckout({ amountCents, currency, orderId, successUrl, cancelUrl }) {
    const c = cfg();
    const tracker = await call<{ data: { token: string; state: string } }>("/order/v1/init", {
      method: "POST",
      secret: c.secretKey,
      body: JSON.stringify({ client: c.publicKey, amount: amountCents / 100, currency, environment: c.env }),
    });
    const ref = tracker.data.token;
    // webhooks=true makes the hosted page navigate to `redirect_url?order_id&tracker` by
    // itself once paid (without it Safepay only shows a Close button). Safepay appends
    // the query with "?", so the URLs we pass must not carry one.
    if (successUrl.includes("?") || cancelUrl.includes("?")) throw new Error("Safepay redirect URLs must not contain a query string");
    const url = new URL(c.base + "/checkout/pay");
    url.search = new URLSearchParams({
      env: c.env,
      beacon: ref,
      source: "custom",
      webhooks: "true",
      order_id: orderId,
      redirect_url: successUrl,
      cancel_url: cancelUrl,
    }).toString();
    return { ref, checkoutUrl: url.toString() };
  },

  async fetchStatus(ref) {
    const c = cfg();
    const r = await call<{ data: { state?: string; amount?: number; currency?: string; transaction?: { token?: string } | null } }>(`/order/v1/${encodeURIComponent(ref)}`, { method: "GET", secret: c.secretKey });
    const state = String(r.data.state ?? "UNKNOWN").toUpperCase();
    const paid = state === PAID_STATE && Boolean(r.data.transaction?.token);
    return {
      state,
      paid,
      capturedCents: paid ? Math.round(Number(r.data.amount) * 100) : null,
      capturedCurrency: paid ? String(r.data.currency ?? "").toUpperCase() : null,
      raw: r.data,
    };
  },

  verifyWebhook(rawBody, signatureHeader) {
    const secret = cfg().webhookSecret;
    if (!secret || !signatureHeader) return false;
    const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  },
};

/** Active provider. Swap here to move to another gateway. */
export const paymentProvider: PaymentProvider = safepay;
