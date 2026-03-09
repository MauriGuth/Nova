-- AlterTable
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "route_polyline" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "actual_arrival_at" TIMESTAMP(3);
