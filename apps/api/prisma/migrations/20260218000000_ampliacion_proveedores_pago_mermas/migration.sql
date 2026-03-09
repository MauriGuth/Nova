-- CreateEnum: medio de pago por proveedor
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'CHECK', 'TRANSFER', 'ACCOUNT');

-- AlterTable suppliers: medio de pago
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_method" "SupplierPaymentMethod" DEFAULT 'TRANSFER';

-- CreateTable supplier_price_history (historial de precios para comparación e IA)
CREATE TABLE IF NOT EXISTS "supplier_price_history" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "unit_cost" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_receipt_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "supplier_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supplier_price_history_supplier_id_idx" ON "supplier_price_history"("supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_price_history_product_id_idx" ON "supplier_price_history"("product_id");
CREATE INDEX IF NOT EXISTS "supplier_price_history_recorded_at_idx" ON "supplier_price_history"("recorded_at");
CREATE INDEX IF NOT EXISTS "supplier_price_history_supplier_id_product_id_idx" ON "supplier_price_history"("supplier_id", "product_id");

ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable payment_orders (orden de pago automática al confirmar ingreso)
CREATE TABLE IF NOT EXISTS "payment_orders" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "goods_receipt_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "invoice_number" TEXT,
    "account_settled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_goods_receipt_id_key" ON "payment_orders"("goods_receipt_id");
CREATE INDEX IF NOT EXISTS "payment_orders_supplier_id_idx" ON "payment_orders"("supplier_id");
CREATE INDEX IF NOT EXISTS "payment_orders_status_idx" ON "payment_orders"("status");
CREATE INDEX IF NOT EXISTS "payment_orders_due_date_idx" ON "payment_orders"("due_date");

ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable waste_records (mermas / desperdicios)
CREATE TABLE IF NOT EXISTS "waste_records" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "recorded_by_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "waste_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "waste_records_location_id_idx" ON "waste_records"("location_id");
CREATE INDEX IF NOT EXISTS "waste_records_product_id_idx" ON "waste_records"("product_id");
CREATE INDEX IF NOT EXISTS "waste_records_recorded_at_idx" ON "waste_records"("recorded_at");
CREATE INDEX IF NOT EXISTS "waste_records_type_idx" ON "waste_records"("type");

ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
