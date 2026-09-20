import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "verification.approved"
  | "verification.rejected"
  | "application.status"
  | "submission.reviewed"
  | "certificate.issued"
  | "certificate.status"
  | "team.invite"
  | "team.accepted"
  | "team.declined"
  | "team.removed"
  | "team.left"
  | "deadline.reminder"
  | "billing.activated"
  | "billing.expired"
  | "billing.reminder"
  | "billing.refunded";

/** In-app notification. Never throws — a failed notification must not break the action. */
export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  try {
    await tx.notification.create({ data: { userId, type, title, body, link } });
  } catch (err) {
    console.error("notification write failed:", type, userId, err);
  }
}
