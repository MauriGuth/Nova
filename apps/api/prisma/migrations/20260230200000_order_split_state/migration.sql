-- AlterTable orders: estado de división de cuenta (splitMode + itemPayer)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "split_mode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "item_payer" JSONB;
