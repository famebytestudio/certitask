import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { BillingError, confirmPayment } from "@/lib/billing";

/**
 * POST /api/billing/confirm { paymentId } — called by the success page after
 * the client returns from Safepay. The server asks Safepay whether the tracker
 * is paid; the redirect itself proves nothing.
 */
export async function POST(req: Request) {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;
  try {
    const { paymentId } = await req.json();
    const payment = await prisma.payment.findUnique({ where: { id: String(paymentId) }, select: { clientId: true } });
    if (!payment || payment.clientId !== auth.userId) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const result = await confirmPayment(String(paymentId), "redirect");
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("Confirm error:", e);
    return NextResponse.json({ error: "Could not confirm the payment yet. If you were charged, it will be applied automatically within a few minutes." }, { status: 502 });
  }
}
