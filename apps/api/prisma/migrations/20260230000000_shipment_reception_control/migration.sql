-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "reception_control_started_at" TIMESTAMP(3),
ADD COLUMN "reception_control_completed_at" TIMESTAMP(3);
