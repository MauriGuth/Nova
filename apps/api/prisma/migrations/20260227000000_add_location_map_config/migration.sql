-- AlterTable
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "map_config" JSONB;
