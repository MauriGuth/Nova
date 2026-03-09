-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "received_by_name" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "received_by_signature" TEXT;
ALTER TABLE "goods_receipts" ADD COLUMN "purchase_order_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_purchase_order_id_key" ON "goods_receipts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
