# Plan de ampliación: Depósito · Logística · Compras · Producción

Sistema actual en funcionamiento para gastronomía con depósito central y múltiples locales. Este documento define **extensiones sin romper lo existente**, con trazabilidad, costos, logística e IA.

---

## 1. Contexto del negocio (flujo a soportar)

| Paso | Dónde | Qué pasa |
|------|--------|----------|
| 1 | Depósito | Entra mercadería sin procesar (carne, panceta, huevos, verduras) |
| 2 | Depósito | Producción primaria: carne → medallones, panceta → bacon, huevos → preparados |
| 3 | Logística | Envío de producción primaria a locales |
| 4 | Local | Producción final: medallón + pan + lechuga = hamburguesa |

Todo el flujo debe quedar **trazado** (origen, lotes, destinos).

---

## 2. Estado actual del sistema (resumen)

### Ya existe

- **Usuarios y roles**: ADMIN, LOCATION_MANAGER, WAREHOUSE_MANAGER, PRODUCTION_WORKER, LOGISTICS, CASHIER, WAITER, KITCHEN, CAFETERIA, AUDITOR
- **Locations**: tipo WAREHOUSE, CAFE, RESTAURANT, EXPRESS
- **Suppliers** y **ProductSupplier** (producto-proveedor, unitCost, minOrderQty, leadTimeDays, isPreferred, lastPurchase)
- **GoodsReceipt** / **GoodsReceiptItem**: ingreso de mercadería, factura, estado draft/confirmed
- **StockLevel**, **StockMovement** (referenceType/referenceId para trazabilidad)
- **Recipe**, **RecipeIngredient**, **ProductionOrder**, **ProductionOrderItem**
- **Shipment**, **ShipmentItem** (origen, destino, status, qrCode, estimatedArrival, dispatchedAt, deliveredAt, receivedAt)
- **Alert**, **AIEvent**, **AuditLog**

### Falta o hay que extender

- Proveedor: medio de pago, historial de precios, lista de precios, comparación con pedidos anteriores
- Órdenes de pago automáticas al confirmar ingreso + factura + cuenta corriente
- Módulo de mermas/desperdicios (tipo, motivo, producto, cantidad, operario, fecha)
- Logística: Google Maps (tiempos, rutas, tiempo real vs estimado)
- Remitos digitales integrados (generación, firma en tablet, actualización de stock)
- Perfiles/permisos por área (Logística, Depósito, Local, Admin)
- Inteligencia pre-compra (último precio, diferencia %, ranking, Barato/Normal/Caro)
- QR por lote de producción primaria (código único, fecha, operario, cantidad)
- Gestión de incidentes (producción fuera de rango, mermas excesivas, retrasos, costos anómalos)

---

## 3. Fases de implementación

### Fase 1 – Base de datos y proveedores (sin romper nada)

| Ítem | Descripción | Schema / API |
|------|-------------|--------------|
| 1.1 | **Medio de pago por proveedor** | `Supplier.paymentMethod` (enum: CASH, CHECK, TRANSFER, ACCOUNT) |
| 1.2 | **Historial de precios** | Nuevo modelo `SupplierPriceHistory` (supplierId, productId, unitCost, recordedAt, sourceReceiptId?) |
| 1.3 | **Lista de precios actualizada** | Vista/endpoint que tome último precio por producto-proveedor desde `SupplierPriceHistory` o `ProductSupplier.unitCost` |
| 1.4 | **Comparación al cargar compra** | Al guardar/confirmar GoodsReceipt: comparar precios ítem a ítem con último precio conocido; devolver/subir `priceChange: 'up' | 'down' | 'same'` y % |

### Fase 2 – Órdenes de pago y mermas

| Ítem | Descripción | Schema / API |
|------|-------------|--------------|
| 2.1 | **Orden de pago** | Nuevo modelo `PaymentOrder` (supplierId, goodsReceiptId?, amount, status, dueDate, invoiceNumber?, accountSettledAt?) |
| 2.2 | **Al confirmar ingreso** | Al confirmar GoodsReceipt: crear PaymentOrder, asociar factura, notificación a admin (Alert o notificación interna) |
| 2.3 | **Cuenta corriente** | Si proveedor es cuenta corriente: marcar PaymentOrder como pendiente; modelo opcional `SupplierAccountMovement` si se necesita detalle |
| 2.4 | **Módulo mermas** | Nuevo modelo `WasteRecord` (locationId, productId, type, reason, quantity, unit, recordedById, recordedAt, notes) |
| 2.5 | **IA mermas** | Análisis de patrones (por producto, tipo, operario, fecha) y sugerencias en AIEvent |

### Fase 3 – Logística y remitos

| Ítem | Descripción | Schema / API |
|------|-------------|--------------|
| 3.1 | **Google Maps** | Servicio opcional: estimación de tiempo, rutas; campos en `Shipment`: estimatedDurationMin, routePolyline?, actualArrivalAt? |
| 3.2 | **Comparar estimado vs real** | Guardar `estimatedArrival` y `receivedAt`/`deliveredAt`; reporte o KPI de desvío |
| 3.3 | **Remito digital** | Generar PDF/HTML por envío (productos, cantidades, destino, tiempo estimado); disponible para conductor, local y admin |
| 3.4 | **Flujo recepción** | Conductor entrega → local controla → firma en tablet (campo `receivedBySignature` o similar) → OK → actualizar stock (ya existe lógica de recepción de shipment) |

### Fase 4 – Perfiles y permisos

| Ítem | Descripción |
|------|-------------|
| 4.1 | Reforzar rutas por rol: Logística (rutas, remitos, entregas), Depósito (producción, mermas, stock), Local (recepción, producción final), Admin (visión total) |
| 4.2 | Guards y decoradores por recurso (ej. solo WAREHOUSE_MANAGER puede confirmar mermas de depósito) |

### Fase 5 – Inteligencia de compras y QR producción

| Ítem | Descripción |
|------|-------------|
| 5.1 | **Pre-compra**: antes de confirmar pedido, mostrar último precio, actual, diferencia %, ranking proveedores; clasificación Barato/Normal/Caro con IA |
| 5.2 | **QR por lote**: al completar ProductionOrder (o lote primario), generar código único; modelo `ProductionBatch` (id, productionOrderId?, productId, quantity, unit, producedAt, producedById, qrCode) |

### Fase 6 – Incidentes y reportes

| Ítem | Descripción |
|------|-------------|
| 6.1 | Detección: producción fuera de rango, mermas excesivas, retrasos, costos anómalos |
| 6.2 | Generar reporte diario, Alert y/o AIEvent con solicitud de acción correctiva |

---

## 4. Reglas de implementación

- **NO** eliminar módulos ni endpoints existentes.
- **NO** cambiar contratos de API ya usados; solo agregar campos opcionales o nuevos endpoints.
- **Compatibilidad**: nuevos campos en BD con valores por defecto o nullable.
- **Versionar**: migraciones Prisma numeradas; documentar cada extensión en este doc o en CHANGELOG.
- **Documentar**: cada nuevo módulo con README o sección en API_SPEC.

---

## 5. Orden sugerido (sprints)

1. **Fase 1** – Schema + migración (Supplier.paymentMethod, SupplierPriceHistory); endpoints de historial y comparación de precios en compras.
2. **Fase 2** – PaymentOrder + creación al confirmar ingreso; módulo WasteRecord + CRUD + IA básica.
3. **Fase 3** – Remito digital (PDF); campos shipment para tiempo real; integración Google Maps (opcional, clave en .env).
4. **Fase 4** – Permisos por ruta según rol.
5. **Fase 5** – Pre-compra en UI + ProductionBatch/QR.
6. **Fase 6** – Jobs o cron para detección de incidentes y reporte diario.

---

## 6. Objetivo final

- Trazabilidad completa (mercadería → producción primaria → envío → producción final).
- Control de costos (historial precios, órdenes de pago, mermas).
- Optimización logística (tiempos, rutas, remitos).
- Inteligencia de compras (comparación, ranking, recomendaciones).
- Auditoría automática (incidentes, reportes, alertas).

Sin perder estabilidad del sistema actual.

---

## 7. Estado de implementación (inicial)

| Fase | Qué se hizo |
|------|-------------|
| **Schema** | Enum `SupplierPaymentMethod`, `Supplier.paymentMethod`, tablas `supplier_price_history`, `payment_orders`, `waste_records`. Migración: `20260218000000_ampliacion_proveedores_pago_mermas`. |
| **Proveedores** | DTOs aceptan `paymentMethod`. Endpoint `GET /suppliers/:id/price-history` (productId, limit opcionales). |
| **Ingreso de mercadería** | Al confirmar un GoodsReceipt: se crea `PaymentOrder` (pendiente, con monto e invoice) y por cada ítem se registra `SupplierPriceHistory`. |
| **Mermas** | Módulo `waste-records`: `GET /waste-records`, `GET /waste-records/:id`, `POST /waste-records` (locationId, productId, type, reason, quantity, unit, notes). |

---

### Avance siguiente (plan en curso)

| Funcionalidad | Estado |
|---------------|--------|
| **Comparación de precios** | `GET /goods-receipts/:id/price-comparison` devuelve por ítem: `previousUnitCost`, `currentUnitCost`, `change` (up/down/same), `changePercent`. Usar al cargar/editar compra para mostrar "subió X%", "bajó Y%". |
| **Notificación al crear orden de pago** | Al confirmar ingreso se crea un `Alert` tipo `payment_order` con título "Nueva orden de pago" y mensaje con proveedor, monto y factura. |
| **API órdenes de pago** | Módulo `payment-orders`: `GET /payment-orders` (filtros: supplierId, status, dateFrom, dateTo), `GET /payment-orders/:id` con detalle e ingreso asociado. |
| **ProductionBatch + QR** | Modelo `ProductionBatch` (batchCode, qrCode, productId, quantity, unit, producedAt, producedById). Al completar una orden de producción se crea un lote con código único `BATCH-YYYYMMDD-XXXX`. `GET /production/batches/code/:code` para consultar por escaneo de QR. Migración: `20260218100000_production_batches`. |

**Hecho (remito digital):** Vista "Ver / Imprimir remito" por envío: ruta `/logistics/[id]/remito` con origen, destino, nº envío, fechas, ítems (cantidad enviada/recibida), notas; botón Imprimir (window.print()). Enlace en detalle del envío.

**Hecho (Fase 3.1/3.2):** Campo opcional `estimatedDurationMin` en Shipment (migración `20260219000000_shipment_estimated_duration_min`). En detalle de envío se muestra bloque "Estimado vs real" (llegada estimada, llegada real, desvío en min).

**Hecho (Fase 4):** Sidebar filtrado por rol: cada ruta tiene lista de roles permitidos; ADMIN ve todo; Usuarios y Configuración solo ADMIN; Logística/Mermas/Órdenes de pago según rol.

**Hecho (Fase 6):** Módulo `incidents`: `GET /incidents/report` ejecuta detección de mermas elevadas (7 días, umbral 50 unidades por local) y envíos con retraso > 30 min; crea Alert por cada hallazgo (sin duplicar). En página IA & Alertas, botón "Ejecutar reporte" que llama al endpoint y muestra hallazgos y alertas creadas.

**Hecho (Fase 3.4):** Firma en recepción de envío: campos `receivedByName` y `receivedBySignature` en Shipment; en detalle de envío (estado despachado/en tránsito) formulario opcional "Nombre de quien recibe" y canvas de firma; al confirmar recepción se envían al backend; si ya recibido se muestra "Recepción registrada".

**Hecho (Fase 5.1):** Pre-compra: en modal "Ver detalle" del ingreso de mercadería, columna "Clasificación" por ítem (Barato / Normal / Caro según % de cambio vs último precio: &lt; -5 %, entre -5 y 5 %, &gt; 5 %).

**Hecho (Fase 4.2):** Guards por rol en API: crear merma (POST /waste-records) → WAREHOUSE_MANAGER, LOCATION_MANAGER, ADMIN; órdenes de pago (GET) → ADMIN, WAREHOUSE_MANAGER, LOCATION_MANAGER; envíos crear/preparar/despachar/cancelar → LOGISTICS, WAREHOUSE_MANAGER, ADMIN; recibir envío → LOGISTICS, WAREHOUSE_MANAGER, LOCATION_MANAGER, ADMIN; confirmar/cancelar ingreso (goods-receipts) → WAREHOUSE_MANAGER, ADMIN.

**Hecho (Fase 3.1 – Google Maps opcional):** Servicio `GoogleMapsService` que usa Directions API para estimar duración del trayecto en minutos. Variable de entorno opcional: `GOOGLE_MAPS_API_KEY`. Si está definida y los locales origen/destino tienen `address`, al crear un envío se calcula y guarda `estimatedDurationMin`; además existe `GET /shipments/estimate-duration?originId=&destinationId=` para que el frontend consulte la estimación antes de crear. Sin clave, el servicio retorna `null` y no se bloquea nada.

**Hecho (Fase 2.5 – IA mermas):** Análisis de patrones de mermas (por producto, local, tipo) en últimos 30 días. Endpoint `POST /waste-records/run-analysis` (roles: WAREHOUSE_MANAGER, LOCATION_MANAGER, ADMIN) que agrega datos, genera un resumen con sugerencias y crea un `AIEvent` tipo `waste_analysis`. En página IA & Alertas, bloque "Análisis de mermas" con botón "Ejecutar análisis" que llama al endpoint y muestra el resumen.

**Hecho (Fase 3.1 opcional – routePolyline y actualArrivalAt):** Campos `routePolyline` (String?) y `actualArrivalAt` (DateTime?) en Shipment. Migración `20260221000000_shipment_route_actual_arrival`. Al crear envío, si hay direcciones y API key de Google, se llama `getRouteDetails()` y se guardan duración y polyline. Al confirmar recepción se guarda `actualArrivalAt` con la fecha/hora de llegada real. En detalle de envío: bloque "Estimado vs real" usa `actualArrivalAt` para "Llegada real" si existe; nuevo bloque "Ruta" con indicación "Ruta guardada (polyline)", tiempo estimado y enlace "Ver ruta en Google Maps" (origen/destino).
