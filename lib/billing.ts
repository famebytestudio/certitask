import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments/safepay";
import { FREE_POSTS, PERIOD_DAYS, PLANS, PLAN_RANK, formatUsd, type PlanTier } from "@/lib/plans";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sendReceiptEmail } from "@/lib/email";
import { appUrl } from "@/lib/email-verification";
import type { SessionPayload } from "@/lib/auth-token";

type Tx = Prisma.TransactionClient;

export class BillingError extends Error {
  constructor(message: string, public code: "PLAN_REQUIRED" | "LIMIT_REACHED" | "NOT_VERIFIED" | "INVALID" | "PROVIDER", public status = 402) { super(message); }
}

export const activeSubscriptionSelect = {
  id: true, plan: true, status: true, periodStart: true, periodEnd: true, postsUsed: true, postLimit: true, cancelledAt: true,
} satisfies Prisma.SubscriptionSelect;

/** The client's current ACTIVE period, if any (and not past its end). */
export async function getActiveSubscription(clientId: string, db: Tx | typeof prisma = prisma) {
  return db.subscription.findFirst({
    where: { clientId, status: "ACTIVE", periodEnd: { gt: new Date() } },
    select: activeSubscriptionSelect,
    orderBy: { periodEnd: "desc" },
  });
}

export interface Entitlement {
  verified: boolean;
  freePostsUsed: number;
  freePostsLeft: number;
  subscription: Prisma.SubscriptionGetPayload<{ select: typeof activeSubscriptionSelect }> | null;
  postsLeftInPeriod: number | null; // null = unlimited
  canPost: boolean;
  reason: "FREE" | "SUBSCRIPTION" | "NOT_VERIFIED" | "PLAN_REQUIRED" | "LIMIT_REACHED";
  features: (typeof PLANS)[PlanTier]["features"];
}

const NO_FEATURES = { applicantFilters: false, priorityVisibility: false, analytics: false, featured: false, prioritySupport: false };

/** What a client is allowed to do right now. Single source of truth for gates and UI. */
export async function getEntitlement(clientId: string, db: Tx | typeof prisma = prisma): Promise<Entitlement> {
  const user = await db.user.findUniqueOrThrow({ where: { id: clientId }, select: { verificationStatus: true, freePostsUsed: true } });
  const verified = user.verificationStatus === "VERIFIED";
  const sub = await getActiveSubscription(clientId, db);
  const freePostsLeft = verified ? Math.max(0, FREE_POSTS - user.freePostsUsed) : 0;
  const postsLeftInPeriod = sub ? (sub.postLimit === null ? null : Math.max(0, sub.postLimit - sub.postsUsed)) : 0;
  const features = sub ? PLANS[sub.plan].features : NO_FEATURES;

  if (!verified) return { verified, freePostsUsed: user.freePostsUsed, freePostsLeft: 0, subscription: sub, postsLeftInPeriod, canPost: false, reason: "NOT_VERIFIED", features };
  if (freePostsLeft > 0) return { verified, freePostsUsed: user.freePostsUsed, freePostsLeft, subscription: sub, postsLeftInPeriod, canPost: true, reason: "FREE", features };
  if (!sub) return { verified, freePostsUsed: user.freePostsUsed, freePostsLeft, subscription: null, postsLeftInPeriod: 0, canPost: false, reason: "PLAN_REQUIRED", features };
  if (postsLeftInPeriod === null || postsLeftInPeriod > 0) return { verified, freePostsUsed: user.freePostsUsed, freePostsLeft, subscription: sub, postsLeftInPeriod, canPost: true, reason: "SUBSCRIPTION", features };
  return { verified, freePostsUsed: user.freePostsUsed, freePostsLeft, subscription: sub, postsLeftInPeriod: 0, canPost: false, reason: "LIMIT_REACHED", features };
}

/**
 * Count one published project against the client's allowance. Must run inside
 * the same transaction that flips the project to ACTIVE. Free posts are used
 * first (lifetime), then the active period's quota.
 */
export async function consumePost(tx: Tx, clientId: string, projectId: string): Promise<"FREE" | "SUBSCRIPTION"> {
  const e = await getEntitlement(clientId, tx);
  if (e.reason === "NOT_VERIFIED") throw new BillingError("Complete verification before publishing a project", "NOT_VERIFIED", 403);
  if (e.reason === "PLAN_REQUIRED") throw new BillingError(`You've used your ${FREE_POSTS} free project posts. Choose a plan to keep posting.`, "PLAN_REQUIRED");
  if (e.reason === "LIMIT_REACHED") throw new BillingError(`Your ${PLANS[e.subscription!.plan].name} plan allows ${e.subscription!.postLimit} posts per ${PERIOD_DAYS} days and you've used them all. Upgrade to post more.`, "LIMIT_REACHED");
  if (e.reason === "FREE") {
    await tx.user.update({ where: { id: clientId }, data: { freePostsUsed: { increment: 1 } } });
    await tx.project.update({ where: { id: projectId }, data: { subscriptionId: null } });
    return "FREE";
  }
  await tx.subscription.update({ where: { id: e.subscription!.id }, data: { postsUsed: { increment: 1 } } });
  await tx.project.update({ where: { id: projectId }, data: { subscriptionId: e.subscription!.id } });
  return "SUBSCRIPTION";
}

/** Rules for which plan a client may buy right now. */
export async function assertPlanPurchasable(clientId: string, plan: PlanTier) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { verificationStatus: true, emailVerifiedAt: true } });
  if (!user.emailVerifiedAt) throw new BillingError("Confirm your email address first", "INVALID", 403);
  if (user.verificationStatus !== "VERIFIED") throw new BillingError("Complete verification before subscribing", "NOT_VERIFIED", 403);
  const sub = await getActiveSubscription(clientId);
  if (sub && PLAN_RANK[plan] < PLAN_RANK[sub.plan]) {
    throw new BillingError(`You're on ${PLANS[sub.plan].name} until ${sub.periodEnd!.toDateString()}. A lower plan can be chosen when it ends.`, "INVALID", 409);
  }
  return sub;
}

/** Create a PENDING subscription + payment and return the hosted checkout URL. */
export async function startCheckout(actor: SessionPayload, plan: PlanTier) {
  const current = await assertPlanPurchasable(actor.userId, plan);
  const def = PLANS[plan];

  // Abandon any earlier unpaid attempt.
  await prisma.payment.updateMany({ where: { clientId: actor.userId, status: "PENDING" }, data: { status: "CANCELLED" } });
  await prisma.subscription.updateMany({ where: { clientId: actor.userId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", cancelledAt: new Date() } });

  const subscription = await prisma.subscription.create({ data: { clientId: actor.userId, plan, postLimit: def.postLimit, status: "PENDING_PAYMENT" } });
  const payment = await prisma.payment.create({
    data: { clientId: actor.userId, subscriptionId: subscription.id, plan, amountCents: def.priceCents, currency: "USD", status: "PENDING", expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });

  let checkout;
  try {
    checkout = await paymentProvider.createCheckout({
      amountCents: def.priceCents,
      currency: "USD",
      orderId: payment.id,
      description: `CertiTask ${def.name} plan — ${PERIOD_DAYS} days`,
      successUrl: `${appUrl()}/payment/success`, // Safepay appends ?order_id=<payment.id>&tracker=…
      cancelUrl: `${appUrl()}/payment/cancel`,
    });
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", providerState: String(e).slice(0, 200) } });
    throw new BillingError("The payment provider is unavailable right now. Please try again in a minute.", "PROVIDER", 503);
  }
  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: checkout.ref } });
  await audit(actor, "billing.checkout_started", "payment", payment.id, { plan, amountCents: def.priceCents, ref: checkout.ref, upgradeFrom: current?.plan ?? null });
  return { paymentId: payment.id, checkoutUrl: checkout.checkoutUrl, amountCents: def.priceCents };
}

async function nextReceiptNumber(tx: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  // Zero-padded, so the lexically largest number is the numerically largest. Survives deleted rows.
  const last = await tx.payment.findFirst({ where: { receiptNumber: { startsWith: `CT-${year}-` } }, orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } });
  const next = last ? parseInt(last.receiptNumber!.slice(-6), 10) + 1 : 1;
  return `CT-${year}-${String(next).padStart(6, "0")}`;
}

/**
 * Confirm a payment by asking the provider (never trust a redirect). Idempotent:
 * a payment already SUCCEEDED returns immediately. Activates the subscription.
 */
export async function confirmPayment(paymentId: string, source: "redirect" | "webhook"): Promise<{ status: string; subscriptionId: string | null }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { subscription: true, client: { select: { id: true, name: true, email: true } } } });
  if (!payment) throw new BillingError("Payment not found", "INVALID", 404);
  if (payment.status === "SUCCEEDED") return { status: "SUCCEEDED", subscriptionId: payment.subscriptionId };
  if (!payment.providerRef) throw new BillingError("Payment was never sent to the provider", "INVALID", 409);

  const status = await paymentProvider.fetchStatus(payment.providerRef);
  await prisma.payment.update({ where: { id: paymentId }, data: { providerState: status.state } });
  if (!status.paid) return { status: payment.status, subscriptionId: payment.subscriptionId };
  if (status.capturedCents !== payment.amountCents || status.capturedCurrency !== payment.currency) {
    // Never activate on a mismatched capture; leave it for an admin to look at.
    await prisma.payment.update({ where: { id: paymentId }, data: { providerState: `${status.state} (captured ${status.capturedCents} ${status.capturedCurrency}, expected ${payment.amountCents} ${payment.currency})` } });
    await audit("system", "billing.amount_mismatch", "payment", paymentId, { source, captured: status.capturedCents, currency: status.capturedCurrency, expected: payment.amountCents });
    throw new BillingError("The captured amount does not match this order. Support has been notified.", "PROVIDER", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so redirect + webhook can't both activate.
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (fresh.status === "SUCCEEDED") return { status: "SUCCEEDED", subscriptionId: fresh.subscriptionId, alreadyDone: true, receipt: fresh.receiptNumber };

    const receipt = await nextReceiptNumber(tx);
    await tx.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED", paidAt: new Date(), receiptNumber: receipt } });

    const subscriptionId = fresh.subscriptionId;
    if (subscriptionId) {
      const start = new Date();
      const end = new Date(start.getTime() + PERIOD_DAYS * 86_400_000);
      // Any other active period is superseded (upgrade / early renewal).
      await tx.subscription.updateMany({ where: { clientId: fresh.clientId, status: "ACTIVE", id: { not: subscriptionId } }, data: { status: "EXPIRED", periodEnd: start } });
      await tx.subscription.update({ where: { id: subscriptionId }, data: { status: "ACTIVE", periodStart: start, periodEnd: end, postsUsed: 0 } });
    }
    await audit({ userId: fresh.clientId, role: "CLIENT" }, "billing.payment_succeeded", "payment", paymentId, { source, plan: fresh.plan, amountCents: fresh.amountCents, receipt }, tx);
    return { status: "SUCCEEDED", subscriptionId, alreadyDone: false, receipt };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!result.alreadyDone && payment.plan) {
    const def = PLANS[payment.plan];
    await notify(payment.client.id, "billing.activated", `${def.name} plan active`, `Thanks for subscribing. You can post ${def.postLimit ?? "unlimited"} projects in the next ${PERIOD_DAYS} days. Receipt ${result.receipt}.`, "/client/dashboard?tab=billing");
    void sendReceiptEmail(payment.client.email, payment.client.name, def.name, formatUsd(payment.amountCents), result.receipt!, `${appUrl()}/client/dashboard?tab=billing`).catch((e) => console.error("receipt email failed", e));
  }
  return { status: "SUCCEEDED", subscriptionId: result.subscriptionId };
}

/** Admin marks a payment refunded (after refunding in the Safepay dashboard). Ends the subscription. */
export async function markRefunded(actor: SessionPayload, paymentId: string, reason: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new BillingError("Payment not found", "INVALID", 404);
  if (payment.status !== "SUCCEEDED") throw new BillingError("Only successful payments can be refunded", "INVALID", 409);
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED", refundedAt: new Date(), refundReason: reason } });
    if (payment.subscriptionId) await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: "CANCELLED", cancelledAt: new Date(), periodEnd: new Date() } });
    await audit(actor, "billing.refunded", "payment", paymentId, { reason }, tx);
  });
  await notify(payment.clientId, "billing.refunded", "Payment refunded", `Your payment ${payment.receiptNumber ?? ""} was refunded. ${reason}`, "/client/dashboard?tab=billing");
}

/** Daily: expire periods that ended; send 5-day / 1-day reminders. */
export async function runBillingMaintenance() {
  const now = new Date();
  const expired = await prisma.subscription.findMany({ where: { status: "ACTIVE", periodEnd: { lte: now } }, select: { id: true, clientId: true, plan: true } });
  for (const s of expired) {
    await prisma.subscription.update({ where: { id: s.id }, data: { status: "EXPIRED" } });
    await notify(s.clientId, "billing.expired", `${PLANS[s.plan].name} plan ended`, "Renew to keep posting projects. Your live projects are unaffected.", "/client/dashboard?tab=billing");
  }
  const in5 = new Date(now.getTime() + 5 * 86_400_000);
  const in1 = new Date(now.getTime() + 1 * 86_400_000);
  const soon5 = await prisma.subscription.findMany({ where: { status: "ACTIVE", cancelledAt: null, reminded5At: null, periodEnd: { lte: in5, gt: in1 } }, select: { id: true, clientId: true, plan: true, periodEnd: true } });
  for (const s of soon5) {
    await prisma.subscription.update({ where: { id: s.id }, data: { reminded5At: now } });
    await notify(s.clientId, "billing.reminder", `${PLANS[s.plan].name} plan ends in 5 days`, `Renew before ${s.periodEnd!.toDateString()} to keep posting without interruption.`, "/client/dashboard?tab=billing");
  }
  const soon1 = await prisma.subscription.findMany({ where: { status: "ACTIVE", cancelledAt: null, reminded1At: null, periodEnd: { lte: in1, gt: now } }, select: { id: true, clientId: true, plan: true, periodEnd: true } });
  for (const s of soon1) {
    await prisma.subscription.update({ where: { id: s.id }, data: { reminded1At: now } });
    await notify(s.clientId, "billing.reminder", `${PLANS[s.plan].name} plan ends tomorrow`, "Renew today to keep posting projects.", "/client/dashboard?tab=billing");
  }
  await prisma.payment.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "CANCELLED" } });
  return { expired: expired.length, reminded: soon5.length + soon1.length };
}
