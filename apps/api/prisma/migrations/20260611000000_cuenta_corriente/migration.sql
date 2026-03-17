-- AlterTable: Customer - add credit_limit for running account
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_limit" DOUBLE PRECISION;

-- AlterTable: Order - add cuenta corriente fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cuenta_corriente_status" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "remito_sent_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoiced_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "orders_invoice_type_idx" ON "orders"("invoice_type");
CREATE INDEX IF NOT EXISTS "orders_cuenta_corriente_status_idx" ON "orders"("cuenta_corriente_status");

-- AlterTable: CashRegister - add total_cuenta_corriente
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "total_cuenta_corriente" DOUBLE PRECISION NOT NULL DEFAULT 0;
