-- AlterTable orders: desglose de pago por comensal (cuenta dividida)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_breakdown" JSONB;
