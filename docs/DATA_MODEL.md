# ELIO — Modelo de Datos

## Base de Datos Relacional (PostgreSQL 16+)

---

## 1. Diagrama de Entidades (ERD Simplificado)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   tenants   │────<│  locations  │────<│stock_levels │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │            ┌──────┴──────┐            │
       │            │             │            │
┌──────┴──────┐  ┌──┴────────┐ ┌─┴──────────┐ │
│   users     │  │  orders   │ │  shipments │ │
└─────────────┘  └───────────┘ └────────────┘ │
       │              │              │         │
       │         ┌────┴────┐   ┌────┴────┐    │
       │         │ order_  │   │shipment_│    │
       │         │ items   │   │ items   │    │
       │         └─────────┘   └─────────┘    │
       │                                       │
┌──────┴──────┐  ┌───────────┐  ┌─────────────┘
│   products  │──│ categories│  │
└─────────────┘  └───────────┘  │
       │                        │
  ┌────┴────┐  ┌────────────┐   │
  │ recipes │  │  stock_    │───┘
  │         │  │ movements  │
  └────┬────┘  └────────────┘
       │
  ┌────┴──────────┐
  │recipe_        │
  │ingredients    │
  └───────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ suppliers   │  │ goods_      │  │ production_ │
│             │  │ receipts    │  │ orders      │
└─────────────┘  └─────────────┘  └─────────────┘
       │              │                   │
       │         ┌────┴────┐        ┌────┴────┐
       │         │receipt_ │        │prod_    │
       └─────────│items    │        │order_   │
                 └─────────┘        │items    │
                                    └─────────┘
```

---

## 2. Entidades del Sistema

### 2.1 Tenants (Multi-tenancy)

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    logo_url        TEXT,
    timezone        VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
    currency        VARCHAR(3) DEFAULT 'ARS',
    plan            VARCHAR(50) DEFAULT 'basic', -- basic, full, enterprise
    is_active       BOOLEAN DEFAULT true,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Settings JSON ejemplo:
-- {
--   "stock_alert_threshold": 1.5,
--   "auto_suggest_production": true,
--   "receipt_diff_auto_approve_pct": 5,
--   "receipt_diff_block_pct": 10,
--   "comanda_urgent_minutes": 20,
--   "ai_features_enabled": true
-- }
```

### 2.2 Locations (Ubicaciones/Locales)

```sql
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL, -- 'warehouse', 'cafe', 'restaurant', 'express'
    address         TEXT,
    phone           VARCHAR(50),
    lat             DECIMAL(10, 8),
    lng             DECIMAL(11, 8),
    is_active       BOOLEAN DEFAULT true,
    is_production   BOOLEAN DEFAULT false, -- si tiene capacidad de producción
    has_tables      BOOLEAN DEFAULT false, -- si tiene servicio de mesas
    settings        JSONB DEFAULT '{}',
    last_heartbeat  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_locations_tenant ON locations(tenant_id);
CREATE INDEX idx_locations_type ON locations(type);
```

### 2.3 Users (Usuarios)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(50),
    avatar_url      TEXT,
    role            VARCHAR(50) NOT NULL, -- roles definidos abajo
    location_id     UUID REFERENCES locations(id), -- NULL = acceso a todos
    is_active       BOOLEAN DEFAULT true,
    last_login      TIMESTAMPTZ,
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_location ON users(location_id);
```

**Roles del sistema:**

```sql
CREATE TYPE user_role AS ENUM (
    'admin',            -- Admin General
    'location_manager', -- Gerente de Local
    'warehouse_manager',-- Jefe de Depósito
    'production_worker',-- Operario de Producción
    'logistics',        -- Encargado de Logística
    'cashier',          -- Cajero
    'waiter',           -- Mozo
    'kitchen',          -- Cocinero / Barista
    'auditor'           -- Auditor / Contador
);
```

### 2.4 Categories (Categorías de Producto)

```sql
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    icon            VARCHAR(50), -- emoji o ícono
    color           VARCHAR(7),  -- color hex
    parent_id       UUID REFERENCES categories(id), -- subcategorías
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);
```

### 2.5 Products (Productos)

```sql
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    sku             VARCHAR(50) NOT NULL,
    barcode         VARCHAR(50),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category_id     UUID REFERENCES categories(id),
    unit            VARCHAR(20) NOT NULL, -- 'kg', 'lt', 'und', 'caja', 'pack'
    image_url       TEXT,
    avg_cost        DECIMAL(12, 2) DEFAULT 0,
    last_cost       DECIMAL(12, 2) DEFAULT 0,
    sale_price      DECIMAL(12, 2) DEFAULT 0,
    is_sellable     BOOLEAN DEFAULT false,  -- si aparece en menú
    is_ingredient   BOOLEAN DEFAULT true,   -- si se usa como insumo
    is_produced     BOOLEAN DEFAULT false,  -- si se produce internamente
    is_perishable   BOOLEAN DEFAULT false,
    shelf_life_days INT,
    tax_rate        DECIMAL(5, 2) DEFAULT 21.00, -- IVA
    is_active       BOOLEAN DEFAULT true,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, sku)
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('spanish', name));
```

### 2.6 Suppliers (Proveedores)

```sql
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    legal_name      VARCHAR(255),
    tax_id          VARCHAR(20), -- CUIT
    contact_name    VARCHAR(255),
    contact_phone   VARCHAR(50),
    contact_email   VARCHAR(255),
    address         TEXT,
    payment_terms   VARCHAR(100), -- 'contado', '30 días', '60 días'
    bank_info       JSONB DEFAULT '{}',
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    supplier_sku    VARCHAR(50), -- código del proveedor
    unit_cost       DECIMAL(12, 2),
    min_order_qty   DECIMAL(12, 2),
    lead_time_days  INT DEFAULT 1,
    is_preferred    BOOLEAN DEFAULT false,
    last_purchase   TIMESTAMPTZ,
    
    UNIQUE(product_id, supplier_id)
);
```

### 2.7 Stock Levels (Niveles de Stock por Ubicación)

```sql
CREATE TABLE stock_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    quantity        DECIMAL(12, 3) NOT NULL DEFAULT 0,
    min_quantity    DECIMAL(12, 3) NOT NULL DEFAULT 0,
    max_quantity    DECIMAL(12, 3),
    status          VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            WHEN quantity <= min_quantity THEN 'critical'
            WHEN quantity <= min_quantity * 1.5 THEN 'medium'
            WHEN max_quantity IS NOT NULL AND quantity > max_quantity THEN 'excess'
            ELSE 'normal'
        END
    ) STORED,
    last_counted_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, location_id)
);

CREATE INDEX idx_stock_levels_location ON stock_levels(location_id);
CREATE INDEX idx_stock_levels_status ON stock_levels(status);
CREATE INDEX idx_stock_levels_product ON stock_levels(product_id);
```

### 2.8 Stock Movements (Movimientos de Stock)

```sql
CREATE TABLE stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    type            VARCHAR(50) NOT NULL,
    -- Tipos: 'goods_receipt', 'production_in', 'production_out',
    --        'shipment_out', 'shipment_in', 'sale', 'correction',
    --        'waste', 'return', 'internal_consumption', 'count_adjustment'
    quantity        DECIMAL(12, 3) NOT NULL, -- positivo = ingreso, negativo = egreso
    unit_cost       DECIMAL(12, 2),
    reference_type  VARCHAR(50), -- 'goods_receipt', 'production_order', 'shipment', 'order', 'correction'
    reference_id    UUID, -- FK polimórfica al documento origen
    lot_number      VARCHAR(100),
    expiry_date     DATE,
    notes           TEXT,
    user_id         UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
```

### 2.9 Goods Receipts (Ingresos de Mercadería)

```sql
CREATE TABLE goods_receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    receipt_number  VARCHAR(50) NOT NULL, -- Número interno auto
    invoice_number  VARCHAR(100),
    invoice_date    DATE,
    invoice_image   TEXT, -- URL de imagen de la factura
    method          VARCHAR(20) DEFAULT 'manual', -- 'manual', 'ocr'
    ocr_confidence  DECIMAL(5, 2), -- porcentaje de confianza IA
    ocr_raw_data    JSONB, -- datos crudos del OCR
    status          VARCHAR(20) DEFAULT 'draft',
    -- 'draft', 'pending_review', 'confirmed', 'cancelled'
    total_amount    DECIMAL(14, 2),
    notes           TEXT,
    user_id         UUID NOT NULL REFERENCES users(id),
    confirmed_by    UUID REFERENCES users(id),
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goods_receipt_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id      UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    ordered_qty     DECIMAL(12, 3), -- cantidad pedida (si existe OC)
    received_qty    DECIMAL(12, 3) NOT NULL, -- cantidad recibida
    unit_cost       DECIMAL(12, 2) NOT NULL,
    total_cost      DECIMAL(14, 2) GENERATED ALWAYS AS (received_qty * unit_cost) STORED,
    difference      DECIMAL(12, 3) GENERATED ALWAYS AS (
        CASE WHEN ordered_qty IS NOT NULL 
             THEN received_qty - ordered_qty 
             ELSE NULL END
    ) STORED,
    lot_number      VARCHAR(100),
    expiry_date     DATE,
    notes           TEXT,
    ocr_match_conf  DECIMAL(5, 2), -- confianza del match individual
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goods_receipts_supplier ON goods_receipts(supplier_id);
CREATE INDEX idx_goods_receipts_location ON goods_receipts(location_id);
CREATE INDEX idx_goods_receipts_invoice ON goods_receipts(invoice_number);
```

### 2.10 Recipes (Recetas)

```sql
CREATE TABLE recipes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(50), -- 'bakery', 'pastry', 'kitchen', 'drinks'
    version         VARCHAR(20) NOT NULL DEFAULT '1.0',
    yield_qty       DECIMAL(12, 3) NOT NULL, -- cantidad que produce
    yield_unit      VARCHAR(20) NOT NULL, -- unidad del producto final
    product_id      UUID REFERENCES products(id), -- producto resultado
    prep_time_min   INT, -- tiempo de preparación en minutos
    instructions    TEXT,
    image_url       TEXT,
    is_active       BOOLEAN DEFAULT true,
    parent_id       UUID REFERENCES recipes(id), -- versión anterior
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    qty_per_yield   DECIMAL(12, 4) NOT NULL, -- cantidad por yield_qty
    unit            VARCHAR(20) NOT NULL,
    is_optional     BOOLEAN DEFAULT false,
    notes           TEXT,
    sort_order      INT DEFAULT 0
);

CREATE INDEX idx_recipes_tenant ON recipes(tenant_id);
CREATE INDEX idx_recipes_product ON recipes(product_id);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
```

### 2.11 Production Orders (Órdenes de Producción)

```sql
CREATE TABLE production_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    order_number    VARCHAR(50) NOT NULL, -- P-001, P-002...
    recipe_id       UUID NOT NULL REFERENCES recipes(id),
    location_id     UUID NOT NULL REFERENCES locations(id), -- dónde se produce
    planned_qty     DECIMAL(12, 3) NOT NULL,
    actual_qty      DECIMAL(12, 3), -- cantidad real producida
    status          VARCHAR(20) DEFAULT 'draft',
    -- 'draft', 'pending', 'in_progress', 'completed', 'completed_adjusted', 'cancelled'
    estimated_cost  DECIMAL(14, 2),
    actual_cost     DECIMAL(14, 2),
    labor_cost      DECIMAL(14, 2),
    waste_qty       DECIMAL(12, 3) DEFAULT 0,
    waste_notes     TEXT,
    planned_date    DATE NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    started_by      UUID REFERENCES users(id),
    completed_by    UUID REFERENCES users(id),
    ai_suggested    BOOLEAN DEFAULT false, -- si fue sugerido por IA
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id   UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    planned_qty     DECIMAL(12, 3) NOT NULL, -- cantidad planificada de insumo
    actual_qty      DECIMAL(12, 3), -- cantidad real utilizada
    unit_cost       DECIMAL(12, 2),
    total_cost      DECIMAL(14, 2),
    status          VARCHAR(20) DEFAULT 'pending' -- 'pending', 'consumed', 'adjusted'
);

CREATE INDEX idx_production_orders_tenant ON production_orders(tenant_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_date ON production_orders(planned_date);
CREATE INDEX idx_production_orders_recipe ON production_orders(recipe_id);
```

### 2.12 Shipments (Envíos)

```sql
CREATE TABLE shipments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    shipment_number VARCHAR(50) NOT NULL, -- ENV-2026-0211-001
    origin_id       UUID NOT NULL REFERENCES locations(id),
    destination_id  UUID NOT NULL REFERENCES locations(id),
    status          VARCHAR(20) DEFAULT 'draft',
    -- 'draft', 'prepared', 'dispatched', 'in_transit', 'delivered',
    -- 'received', 'received_with_diff', 'closed', 'cancelled'
    qr_code         TEXT, -- código QR único para escaneo
    estimated_arrival TIMESTAMPTZ,
    dispatched_at   TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    total_items     INT DEFAULT 0,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    dispatched_by   UUID REFERENCES users(id),
    received_by     UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id), -- si hubo diferencias
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    sent_qty        DECIMAL(12, 3) NOT NULL,
    received_qty    DECIMAL(12, 3),
    difference      DECIMAL(12, 3) GENERATED ALWAYS AS (
        CASE WHEN received_qty IS NOT NULL 
             THEN received_qty - sent_qty 
             ELSE NULL END
    ) STORED,
    diff_reason     VARCHAR(100),
    diff_photo_url  TEXT,
    unit_cost       DECIMAL(12, 2),
    lot_number      VARCHAR(100),
    notes           TEXT
);

CREATE INDEX idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX idx_shipments_origin ON shipments(origin_id);
CREATE INDEX idx_shipments_destination ON shipments(destination_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_qr ON shipments(qr_code);
```

### 2.13 Stock Corrections (Correcciones de Stock)

```sql
CREATE TABLE stock_corrections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    type            VARCHAR(50) NOT NULL,
    -- 'count_error', 'breakage', 'waste', 'expiry', 'customer_return',
    -- 'internal_transfer', 'internal_consumption', 'other'
    quantity        DECIMAL(12, 3) NOT NULL, -- positivo o negativo
    reason          TEXT NOT NULL,
    photo_url       TEXT,
    requires_approval BOOLEAN DEFAULT false,
    status          VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'approved', 'rejected', 'auto_approved'
    created_by      UUID NOT NULL REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_location ON stock_corrections(location_id);
CREATE INDEX idx_corrections_status ON stock_corrections(status);
```

### 2.14 Orders / Comandas (Pedidos)

```sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    location_id     UUID NOT NULL REFERENCES locations(id),
    order_number    VARCHAR(50) NOT NULL, -- T-001, D-001...
    type            VARCHAR(20) NOT NULL, -- 'dine_in', 'takeaway', 'delivery', 'counter'
    table_id        UUID REFERENCES tables(id),
    status          VARCHAR(20) DEFAULT 'open',
    -- 'open', 'in_progress', 'ready', 'served', 'billing', 'closed', 'cancelled'
    customer_count  INT DEFAULT 1,
    subtotal        DECIMAL(14, 2) DEFAULT 0,
    tax_amount      DECIMAL(14, 2) DEFAULT 0,
    discount_amount DECIMAL(14, 2) DEFAULT 0,
    total           DECIMAL(14, 2) DEFAULT 0,
    payment_method  VARCHAR(50), -- 'cash', 'card', 'mercadopago_qr', 'transfer', 'mixed'
    payment_details JSONB DEFAULT '{}',
    notes           TEXT,
    waiter_id       UUID REFERENCES users(id),
    cashier_id      UUID REFERENCES users(id),
    opened_at       TIMESTAMPTZ DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(12, 2) NOT NULL,
    total_price     DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    sector          VARCHAR(50) NOT NULL, -- 'kitchen', 'bar', 'coffee', 'bakery', 'delivery'
    status          VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'in_progress', 'ready', 'served', 'cancelled'
    notes           TEXT, -- "sin tomate", "bien caliente", etc.
    started_at      TIMESTAMPTZ,
    ready_at        TIMESTAMPTZ,
    served_at       TIMESTAMPTZ,
    prepared_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_location ON orders(location_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(created_at);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_order_items_sector ON order_items(sector);
CREATE INDEX idx_order_items_status ON order_items(status);
```

### 2.15 Tables (Mesas)

```sql
CREATE TABLE tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id),
    name            VARCHAR(50) NOT NULL, -- 'M1', 'T3', 'B5'
    zone            VARCHAR(50) NOT NULL, -- 'main', 'terrace', 'bar', 'vip'
    capacity        INT NOT NULL DEFAULT 4,
    status          VARCHAR(20) DEFAULT 'available',
    -- 'available', 'occupied', 'ordering', 'billing', 'reserved', 'disabled'
    current_order_id UUID REFERENCES orders(id),
    position_x      INT, -- para layout visual del mapa
    position_y      INT,
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tables_location ON tables(location_id);
CREATE INDEX idx_tables_status ON tables(status);
```

### 2.16 AI Events (Eventos de IA)

```sql
CREATE TABLE ai_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    type            VARCHAR(50) NOT NULL,
    -- 'stock_prediction', 'anomaly_detection', 'purchase_suggestion',
    -- 'production_suggestion', 'demand_forecast', 'ocr_result',
    -- 'voice_order'
    severity        VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
    title           VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    data            JSONB DEFAULT '{}', -- datos específicos del evento
    related_entity  VARCHAR(50), -- 'product', 'location', 'recipe'
    related_id      UUID,
    status          VARCHAR(20) DEFAULT 'active',
    -- 'active', 'acknowledged', 'acted_upon', 'dismissed', 'expired'
    action_taken    TEXT,
    action_by       UUID REFERENCES users(id),
    action_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_events_tenant ON ai_events(tenant_id);
CREATE INDEX idx_ai_events_type ON ai_events(type);
CREATE INDEX idx_ai_events_status ON ai_events(status);
CREATE INDEX idx_ai_events_severity ON ai_events(severity);
```

### 2.17 Alerts (Alertas del Sistema)

```sql
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    location_id     UUID REFERENCES locations(id),
    type            VARCHAR(50) NOT NULL,
    -- 'stock_critical', 'stock_medium', 'shipment_overdue',
    -- 'production_pending', 'correction_pending', 'cash_not_closed',
    -- 'location_offline', 'comanda_delayed'
    priority        VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    reference_type  VARCHAR(50),
    reference_id    UUID,
    channels        VARCHAR[] DEFAULT '{"dashboard"}', -- canales de envío
    status          VARCHAR(20) DEFAULT 'active',
    -- 'active', 'read', 'resolved', 'dismissed'
    read_by         UUID REFERENCES users(id),
    read_at         TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_priority ON alerts(priority);
CREATE INDEX idx_alerts_location ON alerts(location_id);
```

### 2.18 Audit Log (Registro de Auditoría)

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    -- 'product.create', 'stock.adjust', 'order.close', 'production.complete', etc.
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    old_data        JSONB, -- estado anterior
    new_data        JSONB, -- estado nuevo
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);
```

### 2.19 Cash Registers (Cajas)

```sql
CREATE TABLE cash_registers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id),
    name            VARCHAR(100) DEFAULT 'Caja Principal',
    status          VARCHAR(20) DEFAULT 'closed', -- 'open', 'closed'
    opened_at       TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    opened_by       UUID REFERENCES users(id),
    closed_by       UUID REFERENCES users(id),
    opening_amount  DECIMAL(14, 2),
    closing_amount  DECIMAL(14, 2),
    expected_amount DECIMAL(14, 2), -- calculado por sistema
    difference      DECIMAL(14, 2),
    sales_cash      DECIMAL(14, 2) DEFAULT 0,
    sales_card      DECIMAL(14, 2) DEFAULT 0,
    sales_qr        DECIMAL(14, 2) DEFAULT 0,
    sales_transfer  DECIMAL(14, 2) DEFAULT 0,
    total_sales     DECIMAL(14, 2) DEFAULT 0,
    total_orders    INT DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cash_location ON cash_registers(location_id);
CREATE INDEX idx_cash_status ON cash_registers(status);
```

---

## 3. Vistas Materializadas (para Performance)

```sql
-- Vista: Stock actual consolidado por producto
CREATE MATERIALIZED VIEW mv_stock_summary AS
SELECT 
    p.id AS product_id,
    p.tenant_id,
    p.sku,
    p.name,
    p.category_id,
    SUM(sl.quantity) AS total_stock,
    COUNT(CASE WHEN sl.status = 'critical' THEN 1 END) AS critical_locations,
    COUNT(CASE WHEN sl.status = 'medium' THEN 1 END) AS medium_locations,
    json_agg(json_build_object(
        'location_id', sl.location_id,
        'location_name', l.name,
        'quantity', sl.quantity,
        'min_quantity', sl.min_quantity,
        'status', sl.status
    )) AS stock_by_location
FROM products p
JOIN stock_levels sl ON sl.product_id = p.id
JOIN locations l ON l.id = sl.location_id
WHERE p.is_active = true
GROUP BY p.id, p.tenant_id, p.sku, p.name, p.category_id;

CREATE UNIQUE INDEX idx_mv_stock_summary ON mv_stock_summary(product_id);

-- Refresh cada 5 minutos via pg_cron
-- SELECT cron.schedule('refresh_stock_summary', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_summary');

-- Vista: Ventas del día por local
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT 
    o.location_id,
    DATE(o.created_at) AS sale_date,
    COUNT(*) AS total_orders,
    SUM(o.total) AS total_sales,
    SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END) AS cash_sales,
    SUM(CASE WHEN o.payment_method = 'card' THEN o.total ELSE 0 END) AS card_sales,
    AVG(o.total) AS avg_ticket,
    AVG(EXTRACT(EPOCH FROM (o.closed_at - o.opened_at))/60) AS avg_duration_min
FROM orders o
WHERE o.status = 'closed'
GROUP BY o.location_id, DATE(o.created_at);

CREATE UNIQUE INDEX idx_mv_daily_sales ON mv_daily_sales(location_id, sale_date);
```

---

## 4. Funciones y Triggers

```sql
-- Trigger: Actualizar stock al confirmar ingreso de mercadería
CREATE OR REPLACE FUNCTION fn_update_stock_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        INSERT INTO stock_levels (product_id, location_id, quantity)
        SELECT 
            ri.product_id,
            NEW.location_id,
            ri.received_qty
        FROM goods_receipt_items ri
        WHERE ri.receipt_id = NEW.id
        ON CONFLICT (product_id, location_id) 
        DO UPDATE SET 
            quantity = stock_levels.quantity + EXCLUDED.quantity,
            updated_at = NOW();
            
        -- Crear movimientos de stock
        INSERT INTO stock_movements (tenant_id, product_id, location_id, type, quantity, unit_cost, reference_type, reference_id, user_id)
        SELECT 
            NEW.tenant_id,
            ri.product_id,
            NEW.location_id,
            'goods_receipt',
            ri.received_qty,
            ri.unit_cost,
            'goods_receipt',
            NEW.id,
            NEW.confirmed_by
        FROM goods_receipt_items ri
        WHERE ri.receipt_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_receipt
AFTER UPDATE ON goods_receipts
FOR EACH ROW
EXECUTE FUNCTION fn_update_stock_on_receipt();

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.columns 
        WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION fn_update_timestamp()', t);
    END LOOP;
END;
$$;

-- Trigger: Verificar stock y generar alertas
CREATE OR REPLACE FUNCTION fn_check_stock_alerts()
RETURNS TRIGGER AS $$
DECLARE
    v_product_name TEXT;
    v_location_name TEXT;
    v_tenant_id UUID;
BEGIN
    SELECT p.name, p.tenant_id INTO v_product_name, v_tenant_id
    FROM products p WHERE p.id = NEW.product_id;
    
    SELECT l.name INTO v_location_name 
    FROM locations l WHERE l.id = NEW.location_id;
    
    IF NEW.status = 'critical' AND (OLD.status IS NULL OR OLD.status != 'critical') THEN
        INSERT INTO alerts (tenant_id, location_id, type, priority, title, message, reference_type, reference_id)
        VALUES (
            v_tenant_id,
            NEW.location_id,
            'stock_critical',
            'high',
            'Stock Crítico: ' || v_product_name,
            v_product_name || ' en ' || v_location_name || ': ' || NEW.quantity || ' (mínimo: ' || NEW.min_quantity || ')',
            'product',
            NEW.product_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_alerts
AFTER INSERT OR UPDATE ON stock_levels
FOR EACH ROW
EXECUTE FUNCTION fn_check_stock_alerts();
```

---

## 5. Políticas de Seguridad (Row-Level Security)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ... etc para todas las tablas

-- Política: Usuarios solo ven datos de su tenant
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Política: Gerentes de local solo ven su local
CREATE POLICY location_isolation ON orders
    USING (
        current_setting('app.current_role') = 'admin'
        OR location_id = current_setting('app.current_location')::UUID
    );

-- Política: Auditores solo lectura
CREATE POLICY auditor_read_only ON products
    FOR SELECT
    USING (current_setting('app.current_role') = 'auditor');
```

---

## 6. Índices de Búsqueda Full-Text

```sql
-- Búsqueda de productos en español
CREATE INDEX idx_products_fts ON products 
    USING gin(
        to_tsvector('spanish', 
            coalesce(name, '') || ' ' || 
            coalesce(sku, '') || ' ' || 
            coalesce(description, '')
        )
    );

-- Búsqueda de proveedores
CREATE INDEX idx_suppliers_fts ON suppliers 
    USING gin(
        to_tsvector('spanish', 
            coalesce(name, '') || ' ' || 
            coalesce(legal_name, '') || ' ' || 
            coalesce(tax_id, '')
        )
    );
```

---

## 7. Datos Semilla (Seed Data)

```sql
-- Categorías por defecto
INSERT INTO categories (tenant_id, name, slug, icon, color, sort_order) VALUES
    (:tenant, 'Secos', 'secos', '🌾', '#8B7355', 1),
    (:tenant, 'Refrigerados', 'refrigerados', '❄️', '#4A90D9', 2),
    (:tenant, 'Congelados', 'congelados', '🧊', '#87CEEB', 3),
    (:tenant, 'Bebidas', 'bebidas', '🥤', '#FF6B6B', 4),
    (:tenant, 'Café & Té', 'cafe-te', '☕', '#6F4E37', 5),
    (:tenant, 'Descartables', 'descartables', '📦', '#A0A0A0', 6),
    (:tenant, 'Limpieza', 'limpieza', '🧹', '#4CAF50', 7),
    (:tenant, 'Elaborados', 'elaborados', '🍰', '#E91E63', 8);
```
