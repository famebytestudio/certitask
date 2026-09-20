-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_projectId_fkey";

-- DropIndex
DROP INDEX "payments_clientId_idx";

-- DropIndex
DROP INDEX "payments_projectId_idx";

-- DropIndex
DROP INDEX "payments_providerPaymentIntentId_key";

-- DropIndex
DROP INDEX "payments_providerSessionId_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "providerPaymentIntentId",
DROP COLUMN "providerSessionId",
DROP COLUMN "receiptUrl",
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "plan" "PlanTier",
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "providerState" TEXT,
ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "provider" SET DEFAULT 'safepay',
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freePostsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "postsUsed" INTEGER NOT NULL DEFAULT 0,
    "postLimit" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "reminded5At" TIMESTAMP(3),
    "reminded1At" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_clientId_status_idx" ON "subscriptions"("clientId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_periodEnd_idx" ON "subscriptions"("status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRef_key" ON "payments"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "payments_clientId_createdAt_idx" ON "payments"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
