-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "priority" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;
