-- AlterTable: informe comparativo con mismo día de la semana anterior (IA)
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "comparison_report" TEXT;
