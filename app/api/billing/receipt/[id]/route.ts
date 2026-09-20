import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PERIOD_DAYS, PLANS, formatUsd } from "@/lib/plans";

type Params = { params: Promise<{ id: string }> };

/** GET /api/billing/receipt/[id] — PDF receipt for a successful payment (owner or admin). */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("CLIENT", "ADMIN");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const p = await prisma.payment.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, legalName: true, email: true, clientType: true, location: true } }, subscription: { select: { periodStart: true, periodEnd: true } } },
  });
  if (!p || (auth.role !== "ADMIN" && p.clientId !== auth.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.status !== "SUCCEEDED" && p.status !== "REFUNDED") return NextResponse.json({ error: "No receipt for an unpaid attempt" }, { status: 409 });

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0.06, 0.16, 0.29), gold = rgb(0.79, 0.64, 0.15), gray = rgb(0.35, 0.4, 0.47);
  const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
  let y = 790;
  const text = (t: string, x: number, size: number, f = font, color = navy) => { page.drawText(t, { x, y, size, font: f, color }); };

  text("CertiTask", 50, 24, bold); page.drawText("Task", { x: 50 + bold.widthOfTextAtSize("Certi", 24), y, size: 24, font: bold, color: gold });
  y -= 18; text("Receipt", 50, 11, font, gray);
  page.drawText(p.receiptNumber ?? "", { x: 545 - bold.widthOfTextAtSize(p.receiptNumber ?? "", 14), y: 790, size: 14, font: bold, color: navy });
  page.drawText(p.status === "REFUNDED" ? "REFUNDED" : "PAID", { x: 545 - bold.widthOfTextAtSize(p.status === "REFUNDED" ? "REFUNDED" : "PAID", 11), y: 772, size: 11, font: bold, color: p.status === "REFUNDED" ? rgb(0.6, 0.15, 0.15) : rgb(0.15, 0.5, 0.3) });
  y -= 30; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: gold });

  y -= 30; text("Billed to", 50, 10, bold, gray); text("Payment", 320, 10, bold, gray);
  y -= 16; text(p.client.legalName || p.client.name, 50, 12, bold); text(`Date: ${fmt(p.paidAt)}`, 320, 11);
  y -= 15; text(p.client.email, 50, 10, font, gray); text(`Method: Safepay (card / wallet)`, 320, 11);
  y -= 15; if (p.client.location) text(p.client.location, 50, 10, font, gray); text(`Reference: ${p.providerRef ?? "—"}`, 320, 9, font, gray);

  y -= 40; page.drawRectangle({ x: 50, y: y - 8, width: 495, height: 24, color: rgb(0.95, 0.96, 0.98) });
  text("Description", 58, 10, bold, gray); text("Period", 330, 10, bold, gray); text("Amount", 495, 10, bold, gray);
  const plan = p.plan ? PLANS[p.plan] : null;
  y -= 28; text(`CertiTask ${plan?.name ?? "Plan"} plan — ${PERIOD_DAYS} days`, 58, 11, bold);
  text(p.subscription?.periodStart ? `${fmt(p.subscription.periodStart)} – ${fmt(p.subscription.periodEnd)}` : "—", 330, 10);
  text(formatUsd(p.amountCents), 495, 11, bold);
  y -= 14; text(plan ? (plan.postLimit ? `${plan.postLimit} project posts` : "Unlimited project posts") : "", 58, 9, font, gray);

  y -= 30; page.drawLine({ start: { x: 330, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 20; text("Total", 330, 12, bold); text(`${formatUsd(p.amountCents)} ${p.currency}`, 470, 12, bold);
  if (p.status === "REFUNDED") { y -= 18; text(`Refunded on ${fmt(p.refundedAt)}${p.refundReason ? ` — ${p.refundReason}` : ""}`, 330, 9, font, rgb(0.6, 0.15, 0.15)); }

  y = 80; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 16; text("Charged in USD; your card statement may show the PKR equivalent settled by Safepay.", 50, 8, font, gray);
  y -= 12; text("CertiTask — Real Projects. Real Proof.", 50, 8, font, gray);

  const bytes = await doc.save();
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${p.receiptNumber ?? "receipt"}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
