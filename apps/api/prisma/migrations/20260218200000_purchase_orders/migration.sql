-- CreateTable: órdenes de compra por demanda (depósito)
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" DOUBLE PRECISION,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "placed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "goods_receipt_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");
CREATE INDEX "purchase_orders_location_id_idx" ON "purchase_orders"("location_id");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_created_by_id_idx" ON "purchase_orders"("created_by_id");
CREATE INDEX "purchase_orders_goods_receipt_id_idx" ON "purchase_orders"("goods_receipt_id");

-- CreateTable: ítems de la orden de compra
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_cost" DOUBLE PRECISION NOT NULL,
    "last_known_cost" DOUBLE PRECISION,
    "price_status" TEXT,
    "notes" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
