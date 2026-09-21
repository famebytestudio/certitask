-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contact_messages_archivedAt_isRead_createdAt_idx" ON "contact_messages"("archivedAt", "isRead", "createdAt");
