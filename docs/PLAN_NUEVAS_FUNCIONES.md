# Plan: Nuevas funciones (Productos, Cierre de caja, Stock, Mesas especiales)

## 1. Productos: agregar, modificar, eliminar

- **Estado actual**: La API tiene `create`, `update` (PATCH), `delete`. En el dashboard, la página Stock tiene **crear** producto; la página de detalle `/stock/[id]` no tiene editar ni eliminar.
- **Acción**: Añadir en la vista de detalle de producto (o en listado) botones **Editar** y **Eliminar**. Formulario de edición con los mismos campos que el alta (nombre, SKU, categoría, precio, unidad, flags). Eliminar con confirmación.

---

## 2. Cierre de caja (2 turnos por día)

- **Estado actual**: Existe modelo `CashRegister` (apertura/cierre, `openingAmount`, `closingAmount`, `expectedAmount`, `difference`, ventas por método, `totalSales`, `totalOrders`). No hay concepto de “turno” ni pantalla de cierre en el POS/dashboard.
- **Acción**:
  - Añadir **turno** (ej. `shift: 'morning' | 'afternoon'` o `shiftNumber: 1 | 2`) en apertura de caja y en el cierre.
  - Pantalla **Cierre de caja** que muestre:
    - Ventas totales del turno
    - Desglose por método (efectivo, tarjeta, QR, transferencia)
    - Monto esperado (apertura + efectivo cobrado)
    - Monto contado al cierre
    - **Faltante** o **sobrante** (diferencia)
    - Número de órdenes
  - Los cierres y movimientos de caja deben verse y exportarse desde el **sistema de gestión** (dashboard): listado de cierres, detalle, movimientos de caja por local/fecha.

---

## 3. Stock: máx/mín por local y alertas

- **Estado actual**: `StockLevel` tiene `minQuantity`, `maxQuantity` por producto y local.
- **Acción**:
  - En alta/edición de niveles de stock por local, permitir definir **mín** y **máx** (ej. 4 mín, 10 máx).
  - Cuando `quantity <= minQuantity`: considerar “pedido urgente”; cantidad a pedir = `maxQuantity - quantity` (ej. 4 cocas → pedir 6 para llegar a 10). Mostrar en **rojo** como prioridad/urgente.
  - Al **cargar** un artículo (ingreso de mercadería / goods receipt), actualizar stock del **local** correspondiente (ya debería hacerse en el flujo de ingresos).
  - Al **finalizar cada turno**: pantalla o modal que muestre:
    - Ítems **urgentes** (stock ≤ mín) en **rojo**
    - Ítems **faltantes** (stock 0 o por debajo de mín) en **verde** (o según criterio de negocio)
    - **Vajilla** faltante (productos categoría vajilla con mismo criterio).

---

## 4. Mesas especiales: Tacho de basura y Errores de comandas

- **Estado actual**: `Table` no tiene tipo; todas son mesas normales.
- **Acción**:
  - Añadir en `Table` un campo **tipo** o **slug** (ej. `type: 'normal' | 'trash' | 'errors'` o `slug: 'mesa-1', 'tacho-basura', 'errores-comandas'`).
  - **Tacho de basura**: vajilla rota, café equivocado no reutilizable, etc. No se devuelve a stock; se registra como merma/consumo.
  - **Errores de comandas**: cambio de gaseosa, error del mozo; el producto se puede reutilizar. Aquí aplica la **devolución a stock autorizada por cajero** (ver punto 6).

---

## 5. Devolución a stock (error de comanda) y informe

- **Flujo**: El mozo comanda Coca pero en realidad era Fanta. Se debe **devolver la Coca al stock del local**.
  - Movimiento de **devolución** (aumento de stock) asociado al ítem o a la “mesa de errores”.
  - Este movimiento debe ser **autorizado por el cajero** del local (confirmación en POS o en pantalla de caja).
  - Una vez autorizado: ejecutar el movimiento de stock y generar un **informe** del movimiento (quién, cuándo, producto, cantidad, orden/comanda relacionada, motivo “error de comanda”).
- **Implementación sugerida**:
  - Tipo de movimiento de stock: `order_return` o `comanda_error`.
  - Estado del movimiento: `pending_approval` → el cajero aprueba → `approved` y se aplica al stock.
  - Endpoint: por ejemplo `POST /orders/items/:id/return` o `POST /stock/return-from-order` con `orderItemId`, `quantity`, `reason`; el backend exige rol cajero (o admin) y registra el movimiento y el informe.

---

## 6. Sincronización con el sistema de gestión

- Cierres de caja y movimientos de caja deben **verse y consultarse** desde el dashboard (sistema de gestión).
- Opciones:
  - Listado de cierres por local y fecha.
  - Detalle de cada cierre (totales, diferencia, notas).
  - Listado de movimientos de caja (ingresos/egresos) por local y fecha.
  - Exportar (CSV/Excel) para contabilidad o auditoría.

---

## Orden de implementación sugerido

1. **Productos**: Editar y eliminar en dashboard (stock detalle o listado).
2. **Cierre de caja**: Turno en modelo/dto, pantalla de cierre en POS/dashboard con ventas, faltante/sobrante; listado de cierres en dashboard.
3. **Stock**: UI para mín/máx por local; alertas urgentes (rojo) y faltantes (verde); pantalla al cierre de turno con urgentes y vajilla.
4. **Mesas especiales**: Tipo en `Table`, creación de mesas “Tacho de basura” y “Errores de comandas”, lógica según tipo.
5. **Devolución autorizada**: Flujo de devolución desde comanda/orden, aprobación cajero, movimiento de stock e informe.
6. **Sistema de gestión**: Vistas y export de cierres y movimientos de caja.
