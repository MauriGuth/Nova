-- CreateTable production_batches (lote con QR para trazabilidad)
CREATE TABLE IF NOT EXISTS "production_batches" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "batch_code" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "produced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produced_by_id" TEXT NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_batches_batch_code_key" ON "production_batches"("batch_code");
CREATE INDEX IF NOT EXISTS "production_batches_production_order_id_idx" ON "production_batches"("production_order_id");
CREATE INDEX IF NOT EXISTS "production_batches_product_id_idx" ON "production_batches"("product_id");
CREATE INDEX IF NOT EXISTS "production_batches_produced_at_idx" ON "production_batches"("produced_at");
CREATE INDEX IF NOT EXISTS "production_batches_batch_code_idx" ON "production_batches"("batch_code");

ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_produced_by_id_fkey" FOREIGN KEY ("produced_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
