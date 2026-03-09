-- AlterTable
ALTER TABLE "supplier_price_lists" ADD COLUMN IF NOT EXISTS "extracted_table" JSONB;
