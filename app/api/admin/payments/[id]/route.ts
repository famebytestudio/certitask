import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isString } from "@/lib/validation";
import { BillingError, confirmPayment, markRefunded } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/payments/[id]  { action: "REFUND", reason } | { action: "RECHECK" } */
export async function PATCH(req: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  try {
    const { id } = await params;
    const { action, reason } = await req.json();
    if (action === "REFUND") {
      if (!isString(reason, 500)) return NextResponse.json({ error: "A reason is required" }, { status: 400 });
      await markRefunded(authorization, id, reason.trim());
      return NextResponse.json({ success: true });
    }
    if (action === "RECHECK") {
      const r = await confirmPayment(id, "webhook");
      return NextResponse.json({ success: true, ...r });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Admin payment action error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
