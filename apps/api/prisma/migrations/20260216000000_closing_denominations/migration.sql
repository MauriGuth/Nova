-- AlterTable cash_registers: conteo por denominación y totales declarados al cierre
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "closing_denominations" JSONB;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "closing_reconciliation" JSONB;
