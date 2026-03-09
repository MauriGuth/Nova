-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "rubro" TEXT;

-- AlterTable
ALTER TABLE "supplier_price_lists" ADD COLUMN IF NOT EXISTS "extracted_text" TEXT;
