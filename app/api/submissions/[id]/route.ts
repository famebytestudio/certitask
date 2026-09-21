import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isString } from "@/lib/validation";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "CLIENT" && session.role !== "TALENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await req.json();
    const status = String(payload.status ?? "").toUpperCase();
    const feedback = payload.feedback;

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Status must be APPROVED or REJECTED" }, { status: 400 });
    }

    if (status === "REJECTED" && !isString(feedback, 5000)) {
      return NextResponse.json({ error: "Tell the team what needs to change" }, { status: 400 });
    }

    if (feedback !== undefined && feedback !== null && feedback !== "" && !isString(feedback, 5000)) {
      return NextResponse.json({ error: "Feedback is too long" }, { status: 400 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (session.role === "CLIENT" && submission.project.clientId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "TALENT" && submission.submittedById !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        status: status === "APPROVED" ? "APPROVED" : "REJECTED",
        feedback: feedback === undefined || feedback === null || feedback === "" ? null : String(feedback).trim(),
      },
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error("Update submission status error:", error);
    return NextResponse.json({ error: "Failed to update submission status" }, { status: 500 });
  }
}
