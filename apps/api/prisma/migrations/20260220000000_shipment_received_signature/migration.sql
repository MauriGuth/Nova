-- AlterTable
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "received_by_name" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "received_by_signature" TEXT;
