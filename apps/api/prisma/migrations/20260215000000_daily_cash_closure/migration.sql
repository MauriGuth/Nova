-- AlterTable cash_registers: daily closure fields (idempotent)
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "sales_debit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "sales_credit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "total_cash_expenses" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "total_withdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "total_extra_income" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "sales_no_ticket" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "internal_consumption" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "closed_by_signature" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "cash_registers_closed_at_idx" ON "cash_registers"("closed_at");

-- AlterTable cash_movements: link to register (idempotent)
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "cash_register_id" TEXT;

CREATE INDEX IF NOT EXISTS "cash_movements_cash_register_id_idx" ON "cash_movements"("cash_register_id");
CREATE INDEX IF NOT EXISTS "cash_movements_type_idx" ON "cash_movements"("type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_cash_register_id_fkey'
  ) THEN
    ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_register_id_fkey"
      FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
