# ELIO — Mapa de Navegación y Flujos UX

---

## 1. Mapa de Navegación Completo

### 1.1 Estructura Jerárquica de Páginas

```
/login                              ── Página de inicio de sesión
/forgot-password                    ── Recuperar contraseña
/reset-password                     ── Resetear contraseña (con token)

/ (Dashboard)                       ── Panel de control principal
│
├── /stock                          ── Productos y Stock
│   ├── /stock?status=critical      ── Filtro: stock crítico
│   ├── /stock?category=secos       ── Filtro: por categoría
│   ├── /stock/new                  ── Nuevo producto
│   ├── /stock/:id                  ── Detalle de producto
│   ├── /stock/:id/edit             ── Editar producto
│   └── /stock/movements            ── Historial de movimientos
│
├── /goods-receipts                 ── Ingresos de Mercadería
│   ├── /goods-receipts/new         ── Nuevo ingreso (manual)
│   ├── /goods-receipts/ocr         ── Nuevo ingreso (OCR)
│   ├── /goods-receipts/:id         ── Detalle de ingreso
│   └── /goods-receipts/:id/review  ── Revisión OCR
│
├── /production                     ── Producción
│   ├── /production/new             ── Nueva orden de producción
│   ├── /production/:id             ── Detalle de orden
│   ├── /production/suggestions     ── Sugerencias IA
│   └── /production/recipes         ── Gestión de recetas
│       ├── /production/recipes/new ── Nueva receta
│       └── /production/recipes/:id ── Detalle/Editar receta
│
├── /logistics                      ── Logística y Envíos
│   ├── /logistics/new              ── Nuevo envío
│   ├── /logistics/:id              ── Detalle/Tracking de envío
│   └── /logistics/:id/receive      ── Recepción en local
│
├── /locations                      ── Locales
│   └── /locations/:id              ── Dashboard del local
│       ├── /locations/:id/stock    ── Stock del local
│       ├── /locations/:id/movements── Movimientos del local
│       ├── /locations/:id/receive  ── Recepción de envío (tablet)
│       └── /locations/:id/corrections ── Correcciones
│
├── /orders                         ── Comandas y Mesas
│   ├── /orders/tables              ── Mapa de mesas
│   ├── /orders/new                 ── Nuevo pedido
│   ├── /orders/:id                 ── Detalle de pedido
│   ├── /orders/kitchen/:sector     ── Monitor de sector
│   └── /orders/counter             ── Pedido mostrador
│
├── /reports                        ── Reportes
│   ├── /reports/sales              ── Ventas
│   ├── /reports/losses             ── Pérdidas y mermas
│   ├── /reports/consumption        ── Consumo de insumos
│   ├── /reports/costs              ── Costos y márgenes
│   ├── /reports/production         ── Producción
│   └── /reports/location-compare   ── Comparativo locales
│
├── /ai                             ── IA y Alertas
│   ├── /ai/events                  ── Eventos de IA
│   ├── /ai/predictions             ── Predicciones
│   └── /ai/anomalies              ── Anomalías
│
├── /users                          ── Usuarios
│   ├── /users/new                  ── Nuevo usuario
│   └── /users/:id                  ── Detalle/Editar
│
├── /settings                       ── Configuración
│   ├── /settings/general           ── General
│   ├── /settings/locations         ── Configurar locales
│   ├── /settings/categories        ── Categorías
│   └── /settings/suppliers         ── Proveedores
│
└── /profile                        ── Mi perfil
```

---

## 2. Flujos de Navegación por Rol

### 2.1 Admin General — Flujo Diario Típico

```
Login ──▶ Dashboard
              │
              ├──▶ Revisar KPIs (stock crítico, alertas IA)
              │         │
              │         ├──▶ Click "12 Stock Crítico" ──▶ /stock?status=critical
              │         │         └──▶ Click producto ──▶ /stock/:id
              │         │                   └──▶ Click "Crear Envío" ──▶ /logistics/new
              │         │
              │         └──▶ Click "5 Alertas IA" ──▶ /ai/events
              │                   └──▶ Click evento ──▶ Modal de detalle
              │                             └──▶ "Crear Orden" ──▶ /production/new
              │
              ├──▶ Revisar Locales
              │         └──▶ Click local ──▶ /locations/:id
              │                   ├──▶ Aprobar corrección ──▶ Modal
              │                   └──▶ Ver stock ──▶ /locations/:id/stock
              │
              └──▶ Reportes (fin de semana)
                        └──▶ /reports/sales
                        └──▶ /reports/losses
                        └──▶ Exportar PDF
```

### 2.2 Jefe de Depósito — Flujo Diario

```
Login ──▶ Dashboard
              │
              ├──▶ Producción
              │     ├──▶ /production/suggestions (IA)
              │     │         └──▶ "Crear desde sugerencia" ──▶ /production/new (pre-llenado)
              │     │
              │     ├──▶ /production (ver pendientes)
              │     │         └──▶ Click orden ──▶ /production/:id
              │     │                   └──▶ "Iniciar Producción"
              │     │                   └──▶ "Completar" (al finalizar)
              │     │
              │     └──▶ /production/recipes (mantener recetas)
              │
              ├──▶ Ingresos
              │     ├──▶ /goods-receipts/new (manual)
              │     │         └──▶ Completar formulario ──▶ Confirmar
              │     │
              │     └──▶ /goods-receipts/ocr (con factura)
              │               └──▶ Subir foto ──▶ Revisar OCR ──▶ Confirmar
              │
              └──▶ Envíos
                    ├──▶ /logistics/new
                    │         └──▶ Seleccionar destino + items ──▶ Crear
                    │         └──▶ "Preparar" ──▶ "Despachar"
                    │
                    └──▶ /logistics (ver estado envíos)
```

### 2.3 Gerente de Local — Flujo Diario

```
Login ──▶ /locations/:id (dashboard de su local)
              │
              ├──▶ Apertura
              │     └──▶ "Abrir Caja" ──▶ Modal ingreso monto inicial
              │
              ├──▶ Recepciones pendientes
              │     └──▶ Click envío pendiente ──▶ /locations/:id/receive
              │               └──▶ Escanear QR ──▶ Completar cantidades ──▶ Confirmar
              │
              ├──▶ Stock bajo
              │     └──▶ /locations/:id/stock
              │               └──▶ "Solicitar Reposición" ──▶ Crea solicitud al depósito
              │
              ├──▶ Correcciones
              │     └──▶ /locations/:id/corrections
              │               └──▶ Aprobar/Rechazar cada corrección
              │
              ├──▶ Mesas (supervisión)
              │     └──▶ /orders/tables
              │               └──▶ Ver tiempos, intervenir si necesario
              │
              └──▶ Cierre
                    └──▶ "Cerrar Caja" ──▶ Modal arqueo ──▶ Confirmar
```

### 2.4 Mozo — Flujo de Servicio

```
Login ──▶ /orders/tables (mapa de mesas)
              │
              ├──▶ Click mesa libre ──▶ Mesa pasa a "Ocupada"
              │         └──▶ /orders/new?table=M2
              │                   │
              │                   ├──▶ Opción A: Manual
              │                   │     └──▶ Seleccionar items del menú
              │                   │     └──▶ Agregar notas
              │                   │     └──▶ "Enviar a Cocina"
              │                   │
              │                   └──▶ Opción B: Voz
              │                         └──▶ Presionar micrófono
              │                         └──▶ Dictar pedido
              │                         └──▶ Revisar transcripción
              │                         └──▶ Confirmar ──▶ "Enviar a Cocina"
              │
              ├──▶ Ver items listos (notificación)
              │         └──▶ Marcar como servido
              │
              └──▶ Cobrar mesa
                        └──▶ Click mesa ──▶ "Cobrar"
                        └──▶ Seleccionar medio de pago
                        └──▶ Confirmar ──▶ Mesa se libera
```

### 2.5 Cocinero — Flujo de Monitor

```
Login ──▶ /orders/kitchen/kitchen (monitor de cocina)
              │
              │  [Pantalla siempre visible — no navega]
              │
              ├──▶ Llega nuevo pedido (sonido + visual)
              │         └──▶ Aparece en columna "En Cola"
              │
              ├──▶ Click "Iniciar" en pedido
              │         └──▶ Pedido pasa a "En Preparación"
              │         └──▶ Timer comienza
              │
              └──▶ Click "Listo" cuando termina
                        └──▶ Item desaparece del monitor
                        └──▶ Mozo recibe notificación
```

---

## 3. Wireframes de Flujos Críticos

### 3.1 Flujo: Login → Dashboard

```
┌─ LOGIN ─────────────────┐     ┌─ DASHBOARD ─────────────────────┐
│                         │     │                                  │
│  ┌───────────────────┐  │     │  Buenos días, Mauricio           │
│  │    🔵 ELIO        │  │     │                                  │
│  │                   │  │     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │  Email            │  │     │  │KPI1│ │KPI2│ │KPI3│ │KPI4│   │
│  │  [______________] │  │ ──▶ │  └────┘ └────┘ └────┘ └────┘   │
│  │                   │  │     │                                  │
│  │  Contraseña       │  │     │  ┌─────────────┐ ┌──────────┐  │
│  │  [______________] │  │     │  │   Gráfico   │ │ Locales  │  │
│  │                   │  │     │  └─────────────┘ └──────────┘  │
│  │  [Iniciar Sesión] │  │     │                                  │
│  │                   │  │     │  ┌─────────────────────────────┐ │
│  │  ¿Olvidó su clave?│  │     │  │  Actividad Reciente         │ │
│  └───────────────────┘  │     │  └─────────────────────────────┘ │
│                         │     │                                  │
└─────────────────────────┘     └──────────────────────────────────┘
```

### 3.2 Flujo: Ingreso OCR (paso a paso)

```
Paso 1: Seleccionar Método          Paso 2: Subir Foto
┌──────────────────────────┐       ┌──────────────────────────┐
│ 📥 Nuevo Ingreso         │       │ 📸 Foto de Factura       │
│                          │       │                          │
│  ┌─────────┐ ┌─────────┐│       │  ┌──────────────────┐   │
│  │ 📝 Manual│ │📸 OCR IA││       │  │                  │   │
│  │         │ │ ★       ││  ──▶  │  │   Arrastrá la    │   │
│  └─────────┘ └─────────┘│       │  │   foto aquí o    │   │
│                          │       │  │   [📷 Cámara]    │   │
│                          │       │  │   [📁 Archivo]   │   │
│                          │       │  │                  │   │
│                          │       │  └──────────────────┘   │
└──────────────────────────┘       └──────────────────────────┘

Paso 3: IA Procesando              Paso 4: Revisión OCR
┌──────────────────────────┐       ┌──────────────────────────┐
│ 🤖 Procesando Factura... │       │ 🤖 Revisión OCR          │
│                          │       │                          │
│  ┌──────────────────┐   │       │ ┌────────┐ ┌───────────┐│
│  │                  │   │       │ │ IMAGEN │ │ Datos:    ││
│  │   ████████████░  │   │       │ │ factura│ │           ││
│  │   Analizando...  │   │  ──▶  │ │        │ │ Proveedor ││
│  │   78%            │   │       │ │        │ │ Factura   ││
│  │                  │   │       │ │        │ │ Items...  ││
│  │  Extrayendo datos│   │       │ └────────┘ └───────────┘│
│  │  de la factura   │   │       │                          │
│  └──────────────────┘   │       │ [Rechazar] [✅ Aprobar]  │
└──────────────────────────┘       └──────────────────────────┘

Paso 5: Completar Ingreso          Paso 6: Confirmación
┌──────────────────────────┐       ┌──────────────────────────┐
│ 📥 Confirmar Ingreso     │       │ ✅ Ingreso Confirmado    │
│                          │       │                          │
│  Proveedor: Molinos ✅   │       │  Ingreso #ING-2026-042  │
│  Factura: FC-A-0001 ✅   │       │                          │
│                          │       │  4 items ingresados      │
│  Items:                  │       │  2 con diferencia        │
│  ┌─ tabla comparativa ─┐│  ──▶  │  Total: $487.500         │
│  │ Pedido vs Recibido   ││       │                          │
│  └──────────────────────┘│       │  Stock actualizado en    │
│                          │       │  Depósito Central ✅     │
│  Observaciones: [_______]│       │                          │
│                          │       │  [Ver Detalle]           │
│  [Cancelar] [✅ Confirmar]│       │  [Nuevo Ingreso]        │
└──────────────────────────┘       └──────────────────────────┘
```

### 3.3 Flujo: Creación y Recepción de Envío

```
DEPÓSITO                                    LOCAL
─────────────────────────────────────────────────────────────

Paso 1: Crear Envío           
┌─────────────────┐           
│ 🚛 Nuevo Envío  │           
│                 │           
│ Destino: [▼]   │           
│ Items: [+]     │           
│ ┌─ lista ─────┐│           
│ │ Harina 50Kg ││           
│ │ Leche  48Lt ││           
│ └─────────────┘│           
│ [✅ Crear]      │           
└────────┬────────┘           
         │                    
Paso 2: Preparar + Despachar  
┌────────▼────────┐           
│ ENV-001         │           
│ [Preparar]      │           
│ [Despachar] ──────────────────▶ Notificación push
└────────┬────────┘                      │
         │                               │
         │                    Paso 3: Recepción
         │                    ┌──────────▼──────┐
         │                    │ 📱 Recepción    │
         │                    │                 │
         │                    │ [📷 Escanear QR]│
         │                    │                 │
         │                    │ Harina [50 ] ✅ │
         │                    │ Leche  [48 ] ✅ │
         │                    │ Medial.[148] ⚠️ │
         │                    │                 │
         │                    │ Motivo: [▼]     │
Paso 4: Validación            │ [📷 Foto]      │
┌─────────────────┐           │ [✅ Confirmar]   │
│ ENV-001         │◀──────────└─────────────────┘
│ Recibido ✅      │
│ Dif: -2 medial. │
│ Auto-aprobado   │
└─────────────────┘
```

---

## 4. Estados y Transiciones de Pantalla

### 4.1 Estados de Carga

```
┌─── LOADING ────────────┐  ┌─── EMPTY ──────────────┐  ┌─── ERROR ──────────────┐
│                        │  │                         │  │                        │
│  ┌──────────────────┐  │  │  ┌───────────────────┐  │  │  ┌──────────────────┐  │
│  │ ░░░░░░░░░░░░░░  │  │  │  │                   │  │  │  │      ⚠️          │  │
│  │ ░░░░░░░░        │  │  │  │   📦              │  │  │  │                  │  │
│  │ ░░░░░░░░░░      │  │  │  │                   │  │  │  │  No se pudieron  │  │
│  │ ░░░░░░░░░░░░░░  │  │  │  │  No hay productos │  │  │  │  cargar los      │  │
│  │ ░░░░░░░░        │  │  │  │  aún. Creá el     │  │  │  │  productos.      │  │
│  │ ░░░░░░░░░░      │  │  │  │  primero.         │  │  │  │                  │  │
│  └──────────────────┘  │  │  │                   │  │  │  │  [Reintentar]    │  │
│                        │  │  │  [+ Nuevo Producto]│  │  │  │                  │  │
│  Skeleton loading con  │  │  └───────────────────┘  │  │  └──────────────────┘  │
│  animación pulse       │  │                         │  │                        │
└────────────────────────┘  └─────────────────────────┘  └────────────────────────┘
```

### 4.2 Transiciones de Estado — Producción

```
┌──────────┐   Confirmar    ┌──────────┐    Iniciar     ┌──────────┐
│ BORRADOR │──────────────▶│ PENDIENTE│──────────────▶│ EN CURSO │
│          │               │          │               │          │
│ • Editar │               │ • Cancel.│               │ • Complet│
│ • Eliminar│               │ • Iniciar│               │ • Problem│
└──────────┘               └──────────┘               └──────────┘
                                │                           │
                           Cancelar                    Completar
                                │                      ┌────┴────┐
                           ┌────▼────┐            ┌────▼────┐┌───▼─────┐
                           │CANCELADA│            │COMPLETA ││AJUSTADA │
                           │         │            │DA       ││         │
                           │ • Ver   │            │ • Ver   ││ • Ver   │
                           └─────────┘            │ • Export││ • Ajust.│
                                                  └─────────┘└─────────┘
```

---

## 5. Patrones de Interacción

### 5.1 Búsqueda Global

```
Atajo: Ctrl+K / Cmd+K

┌──────────────────────────────────────┐
│ 🔍 Buscar productos, locales, envíos│
│ ─────────────────────────────────── │
│                                      │
│ Recientes:                           │
│   📦 Harina 000 x25Kg              │
│   🏪 Café Norte                     │
│   🚛 ENV-2026-0211-001             │
│                                      │
│ Sugerencias:                         │
│   📦 Productos → /stock             │
│   📊 Reportes → /reports            │
│   ⚙️ Config → /settings             │
│                                      │
└──────────────────────────────────────┘
```

### 5.2 Acciones Rápidas desde Dashboard

| Click en | Navega a | Filtro aplicado |
|---|---|---|
| Badge "Stock Crítico" | `/stock` | `?status=critical` |
| Badge "Prod. Pendiente" | `/production` | `?status=pending` |
| Badge "Movimientos" | `/stock/movements` | `?date=today` |
| Badge "Alertas IA" | `/ai/events` | `?status=active` |
| Nombre de local | `/locations/:id` | — |
| Envío en curso | `/logistics/:id` | — |
| Evento IA | Modal de detalle | — |
| Actividad reciente | Entidad referenciada | — |

### 5.3 Breadcrumbs

```
Dashboard > Stock > Harina 000 x25Kg

Dashboard > Producción > Orden #P-087

Dashboard > Logística > Envío #ENV-2026-0211-001

Dashboard > Café Norte > Stock > Leche Entera

Dashboard > Reportes > Ventas
```

### 5.4 Confirmaciones y Acciones Destructivas

| Acción | Confirmación | Tipo |
|---|---|---|
| Confirmar ingreso | Dialog con resumen | Confirm (azul) |
| Iniciar producción | Dialog con insumos a descontar | Confirm (azul) |
| Despachar envío | Dialog con detalle | Confirm (azul) |
| Confirmar recepción con dif. | Dialog con diferencias | Warning (amarillo) |
| Cancelar producción | Dialog "¿Está seguro?" | Danger (rojo) |
| Eliminar producto | Dialog "Esta acción no se puede deshacer" | Danger (rojo) |
| Cerrar caja | Dialog con arqueo obligatorio | Confirm (azul) |

---

## 6. Diseño Responsive — Adaptaciones por Dispositivo

### 6.1 Desktop (1280px+)

- Layout completo con sidebar expandida
- Tablas con todas las columnas
- Gráficos en tamaño completo
- Dashboard con grid 4 columnas KPI
- Drag & drop para mapa de mesas
- Hover interactions habilitadas

### 6.2 Tablet (768-1023px)

**Uso principal:** Recepción de envíos, stock local, comandas

- Sidebar colapsada (toggle con hamburger)
- Tablas con columnas prioritarias (scroll horizontal resto)
- Gráficos adaptados
- Dashboard grid 2 columnas KPI
- Mapa de mesas touch-optimized
- Botones más grandes (44px mínimo)
- Bottom sheet para formularios secundarios

### 6.3 Mobile (< 768px)

**Uso principal:** Monitor de cocina, toma de pedidos

- Sin sidebar → Bottom navigation bar
- Vista de lista en lugar de tabla
- Cards en lugar de filas
- Formularios full-screen
- Swipe para acciones (aprobar/rechazar)
- Cámara nativa para OCR y QR

**Bottom Navigation (mobile):**

```
┌──────────────────────────────────────┐
│                                      │
│        (contenido de la app)         │
│                                      │
├──────────────────────────────────────┤
│  🏠      📦      🍽️      📊      ≡  │
│ Inicio  Stock  Pedidos  Report  Más  │
└──────────────────────────────────────┘
```

---

## 7. Notificaciones y Feedback Visual

### 7.1 Jerarquía de Notificaciones

| Nivel | Canal | Ejemplo | Duración |
|---|---|---|---|
| **Inline** | En contexto | "Stock actualizado" (badge en tabla) | Permanente |
| **Toast** | Top-right | "Ingreso confirmado exitosamente" | 5 seg |
| **Banner** | Top de página | "Hay 3 correcciones pendientes de aprobación" | Hasta dismiss |
| **Modal** | Overlay | "¿Confirmar despacho de 23 items?" | Hasta acción |
| **Push** | Dispositivo | "Envío #ENV-001 recibido en Café Norte" | Según config |
| **Badge** | Sidebar/Icono | 🔴 3 (en ícono de notificaciones) | Hasta leer |

### 7.2 Feedback de Acciones

| Acción | Feedback Inmediato | Feedback Posterior |
|---|---|---|
| Guardar producto | Botón loading → Toast success | — |
| Confirmar ingreso | Botón loading → Toast + redirect a detalle | Badge stock actualizado |
| Iniciar producción | Botón loading → Toast + estado cambia | Monitor actualizado |
| Despachar envío | Botón loading → Toast + QR visible | Push al local destino |
| Enviar comanda | Botón loading → Toast + redirect a mesas | Sonido en cocina |
| OCR de factura | Progress bar 0-100% → Redirect a revisión | — |
| Pedido por voz | Animación de onda → Transcripción visible | — |

---

## 8. Accesibilidad en Flujos

### 8.1 Keyboard Navigation

| Contexto | Atajo | Acción |
|---|---|---|
| Global | `Ctrl+K` | Búsqueda global |
| Global | `Esc` | Cerrar modal/overlay |
| Tabla | `↑↓` | Navegar filas |
| Tabla | `Enter` | Abrir detalle |
| Formulario | `Tab` | Siguiente campo |
| Formulario | `Shift+Tab` | Campo anterior |
| Formulario | `Ctrl+Enter` | Submit formulario |
| Mesas | `1-9` | Seleccionar mesa rápida |
| Monitor cocina | `Space` | Siguiente estado del item |

### 8.2 Semáforo Accesible

El semáforo de stock no depende solo del color:
- 🔴 **Crítico** → Ícono de alerta triangular + texto "Crítico" + color rojo
- 🟡 **Medio** → Ícono de advertencia + texto "Medio" + color amarillo
- 🟢 **Normal** → Ícono check + texto "Normal" + color verde
- 🔵 **Exceso** → Ícono flecha arriba + texto "Exceso" + color azul

---

## 9. Micro-copy y UX Writing

### 9.1 Principios de Escritura

| Principio | Ejemplo Bueno | Ejemplo Malo |
|---|---|---|
| Directo | "Confirmar ingreso" | "Proceder a la confirmación del ingreso" |
| Orientado a acción | "Crear envío a Café Norte" | "Formulario de nuevo envío" |
| Humano | "No hay envíos pendientes" | "Resultados: 0" |
| Informativo | "Se descontarán 45 Kg de Harina del stock" | "¿Confirmar?" |
| Empático ante error | "No pudimos procesar la imagen. Intentá con mejor luz." | "Error 500" |

### 9.2 Patrones de Mensajes

**Vacío (Empty State):**
```
Sin resultados:
  Título: No hay [entidades] que coincidan
  Subtítulo: Probá ajustando los filtros o creá uno nuevo.
  CTA: [Limpiar Filtros] [+ Nuevo]

Nuevo (First Use):
  Título: Aún no tenés [entidades]
  Subtítulo: Creá el primero para empezar a trabajar.
  CTA: [+ Crear Primer Producto]
```

**Éxito:**
```
Creación: "[Entidad] creado exitosamente"
Actualización: "[Entidad] actualizado"
Eliminación: "[Entidad] eliminado"  
Confirmación: "[Acción] confirmada. [detalle relevante]."
```

**Error:**
```
Validación: "Completá los campos marcados en rojo"
Permiso: "No tenés permisos para [acción]. Contactá al administrador."
Conexión: "Error de conexión. Verificá tu internet e intentá de nuevo."
Stock: "Stock insuficiente de [producto]. Disponible: [cantidad]."
Duplicado: "Ya existe un [entidad] con este [campo]. [Ver existente]"
```
