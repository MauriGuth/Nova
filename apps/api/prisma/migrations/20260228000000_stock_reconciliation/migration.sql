-- CreateTable
CREATE TABLE "stock_reconciliations" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shift_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reconciliation_items" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expected_quantity" DOUBLE PRECISION NOT NULL,
    "counted_quantity" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_reconciliations_location_id_idx" ON "stock_reconciliations"("location_id");

-- CreateIndex
CREATE INDEX "stock_reconciliations_user_id_idx" ON "stock_reconciliations"("user_id");

-- CreateIndex
CREATE INDEX "stock_reconciliations_submitted_at_idx" ON "stock_reconciliations"("submitted_at");

-- CreateIndex
CREATE INDEX "stock_reconciliations_status_idx" ON "stock_reconciliations"("status");

-- CreateIndex
CREATE INDEX "stock_reconciliation_items_reconciliation_id_idx" ON "stock_reconciliation_items"("reconciliation_id");

-- CreateIndex
CREATE INDEX "stock_reconciliation_items_product_id_idx" ON "stock_reconciliation_items"("product_id");

-- AddForeignKey
ALTER TABLE "stock_reconciliations" ADD CONSTRAINT "stock_reconciliations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reconciliations" ADD CONSTRAINT "stock_reconciliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reconciliation_items" ADD CONSTRAINT "stock_reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "stock_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reconciliation_items" ADD CONSTRAINT "stock_reconciliation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
