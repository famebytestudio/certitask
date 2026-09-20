import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments/safepay";
import { confirmPayment } from "@/lib/billing";
import { audit } from "@/lib/audit";

/**
 * POST /api/safepay/webhook — Safepay notifies us of tracker events.
 * The raw body is used for the HMAC check. The payload's own state is never
 * trusted: the tracker is looked up and confirmPayment asks Safepay directly.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-sfpy-signature");
  if (!paymentProvider.verifyWebhook(raw, sig)) {
    await audit("system", "billing.webhook_rejected", "webhook", "safepay", { reason: sig ? "bad signature" : "missing signature" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Safepay payloads nest the tracker token under data; accept the common shapes.
  const b = body as { data?: { tracker?: { token?: string } | string; token?: string }; tracker?: string };
  const ref = typeof b.data?.tracker === "string" ? b.data.tracker : b.data?.tracker?.token ?? b.data?.token ?? b.tracker;
  if (!ref) return NextResponse.json({ received: true, ignored: "no tracker" });

  const payment = await prisma.payment.findUnique({ where: { providerRef: ref }, select: { id: true } });
  if (!payment) return NextResponse.json({ received: true, ignored: "unknown tracker" });

  try {
    const result = await confirmPayment(payment.id, "webhook");
    return NextResponse.json({ received: true, status: result.status });
  } catch (e) {
    console.error("Webhook confirm error:", e);
    return NextResponse.json({ received: true, error: "confirm failed" }, { status: 500 });
  }
}
