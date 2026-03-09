import type {
  Product, Category, Location, Supplier, GoodsReceipt,
  ProductionOrder, Shipment, TableInfo,
  Alert, AIEvent, DashboardKPIs, ActivityItem,
  StockMovement,
} from "@/types"

// Categories
export const categories: Category[] = [
  { id: "cat-1", name: "Secos", slug: "secos", icon: "🌾", color: "#8B7355" },
  { id: "cat-2", name: "Refrigerados", slug: "refrigerados", icon: "❄️", color: "#4A90D9" },
  { id: "cat-3", name: "Congelados", slug: "congelados", icon: "🧊", color: "#87CEEB" },
  { id: "cat-4", name: "Bebidas", slug: "bebidas", icon: "🥤", color: "#FF6B6B" },
  { id: "cat-5", name: "Café & Té", slug: "cafe-te", icon: "☕", color: "#6F4E37" },
  { id: "cat-6", name: "Descartables", slug: "descartables", icon: "📦", color: "#A0A0A0" },
  { id: "cat-7", name: "Limpieza", slug: "limpieza", icon: "🧹", color: "#4CAF50" },
  { id: "cat-8", name: "Elaborados", slug: "elaborados", icon: "🍰", color: "#E91E63" },
]

// Locations
export const locations: Location[] = [
  { id: "loc-1", name: "Depósito Central", slug: "deposito", type: "warehouse", address: "Av. Industrial 1200", isActive: true, isProduction: true, hasTables: false, lastHeartbeat: new Date().toISOString(), status: "online" },
  { id: "loc-2", name: "Café Norte", slug: "cafe-norte", type: "cafe", address: "Av. Corrientes 3456", isActive: true, isProduction: false, hasTables: true, lastHeartbeat: new Date().toISOString(), status: "online" },
  { id: "loc-3", name: "Restaurante Sur", slug: "resto-sur", type: "restaurant", address: "Av. Rivadavia 7890", isActive: true, isProduction: false, hasTables: true, lastHeartbeat: new Date().toISOString(), status: "online" },
  { id: "loc-4", name: "Express Centro", slug: "express-centro", type: "express", address: "Florida 234", isActive: true, isProduction: false, hasTables: false, lastHeartbeat: new Date(Date.now() - 15 * 60000).toISOString(), status: "offline" },
]

// Suppliers
export const suppliers: Supplier[] = [
  { id: "sup-1", name: "Molinos del Sur", legalName: "Molinos del Sur S.A.", taxId: "30-71234567-8", contactName: "Roberto García", contactPhone: "+5411-4567-8901", contactEmail: "ventas@molinossur.com", paymentTerms: "30 días", isActive: true },
  { id: "sup-2", name: "Lácteos del Valle", legalName: "Lácteos del Valle S.R.L.", taxId: "30-71234568-9", contactName: "Ana Martínez", contactPhone: "+5411-4567-8902", contactEmail: "pedidos@lacteosvalle.com", paymentTerms: "15 días", isActive: true },
  { id: "sup-3", name: "Distribuidora Central", legalName: "Central Distribuidora S.A.", taxId: "30-71234569-0", contactName: "Carlos López", contactPhone: "+5411-4567-8903", contactEmail: "ventas@distcentral.com", paymentTerms: "Contado", isActive: true },
]

// Products (comprehensive list with stock by location)
export const products: Product[] = [
  {
    id: "prod-1", sku: "HAR-001", barcode: "7790001234567", name: "Harina 000 x25Kg",
    description: "Harina triple cero para panadería y pastelería", category: categories[0],
    unit: "Kg", avgCost: 2450, lastCost: 2500, salePrice: 0, isSellable: false,
    isIngredient: true, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 395,
    worstStatus: "critical",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 350, minQuantity: 100, maxQuantity: 500, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 25, minQuantity: 50, status: "critical" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 15, minQuantity: 30, status: "critical" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 5, minQuantity: 10, status: "medium" },
    ]
  },
  {
    id: "prod-2", sku: "LEC-001", name: "Leche Entera 1L",
    category: categories[1], unit: "Lt", avgCost: 1200, lastCost: 1250, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: true, isActive: true,
    totalStock: 220, worstStatus: "medium",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 150, minQuantity: 80, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 35, minQuantity: 30, status: "normal" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 25, minQuantity: 25, status: "medium" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 10, minQuantity: 15, status: "critical" },
    ]
  },
  {
    id: "prod-3", sku: "CAF-001", name: "Café Grano Colombia 1Kg",
    category: categories[4], unit: "Kg", avgCost: 12500, lastCost: 13000, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 85, worstStatus: "normal",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 50, minQuantity: 20, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 15, minQuantity: 5, status: "normal" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 12, minQuantity: 5, status: "normal" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 8, minQuantity: 3, status: "normal" },
    ]
  },
  {
    id: "prod-4", sku: "AZU-001", name: "Azúcar x50Kg",
    category: categories[0], unit: "Kg", avgCost: 1800, lastCost: 1850, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 280, worstStatus: "normal",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 200, minQuantity: 80, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 35, minQuantity: 15, status: "normal" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 30, minQuantity: 15, status: "normal" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 15, minQuantity: 10, status: "normal" },
    ]
  },
  {
    id: "prod-5", sku: "MAN-001", name: "Manteca x5Kg",
    category: categories[1], unit: "Kg", avgCost: 8500, lastCost: 8800, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: true, isActive: true,
    totalStock: 43, worstStatus: "critical",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 30, minQuantity: 25, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 5, minQuantity: 8, status: "critical" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 5, minQuantity: 8, status: "critical" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 3, minQuantity: 3, status: "medium" },
    ]
  },
  {
    id: "prod-6", sku: "HUE-001", name: "Huevos x30 unidades",
    category: categories[1], unit: "Und", avgCost: 3800, lastCost: 4000, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: true, isActive: true,
    totalStock: 75, worstStatus: "medium",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 45, minQuantity: 30, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 15, minQuantity: 10, status: "normal" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 10, minQuantity: 10, status: "medium" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 5, minQuantity: 5, status: "medium" },
    ]
  },
  {
    id: "prod-7", sku: "CHO-001", name: "Chocolate 70% Cacao 1Kg",
    category: categories[0], unit: "Kg", avgCost: 15000, lastCost: 15500, salePrice: 0,
    isSellable: false, isIngredient: true, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 40, worstStatus: "normal",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 30, minQuantity: 10, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 5, minQuantity: 3, status: "normal" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 3, minQuantity: 3, status: "medium" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 2, minQuantity: 2, status: "medium" },
    ]
  },
  {
    id: "prod-8", sku: "MED-001", name: "Medialuna de Manteca",
    category: categories[7], unit: "Und", avgCost: 275, lastCost: 275, salePrice: 650,
    isSellable: true, isIngredient: false, isProduced: true, isPerishable: true, isActive: true,
    totalStock: 158, worstStatus: "critical",
    stockByLocation: [
      { locationId: "loc-1", locationName: "Depósito Central", quantity: 100, minQuantity: 50, status: "normal" },
      { locationId: "loc-2", locationName: "Café Norte", quantity: 28, minQuantity: 50, status: "critical" },
      { locationId: "loc-3", locationName: "Restaurante Sur", quantity: 20, minQuantity: 30, status: "critical" },
      { locationId: "loc-4", locationName: "Express Centro", quantity: 10, minQuantity: 20, status: "critical" },
    ]
  },
  {
    id: "prod-9", sku: "COR-001", name: "Cortado",
    category: categories[4], unit: "Und", avgCost: 350, lastCost: 350, salePrice: 1800,
    isSellable: true, isIngredient: false, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 0, worstStatus: "normal",
    stockByLocation: []
  },
  {
    id: "prod-10", sku: "CAP-001", name: "Cappuccino",
    category: categories[4], unit: "Und", avgCost: 450, lastCost: 450, salePrice: 2200,
    isSellable: true, isIngredient: false, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 0, worstStatus: "normal",
    stockByLocation: []
  },
  {
    id: "prod-11", sku: "TOS-001", name: "Tostado Jamón y Queso",
    category: categories[7], unit: "Und", avgCost: 800, lastCost: 800, salePrice: 3200,
    isSellable: true, isIngredient: false, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 0, worstStatus: "normal",
    stockByLocation: []
  },
  {
    id: "prod-12", sku: "JUG-001", name: "Jugo de Naranja Natural",
    category: categories[3], unit: "Und", avgCost: 600, lastCost: 600, salePrice: 2500,
    isSellable: true, isIngredient: false, isProduced: false, isPerishable: false, isActive: true,
    totalStock: 0, worstStatus: "normal",
    stockByLocation: []
  },
]

// Production orders
export const productionOrders: ProductionOrder[] = [
  { id: "po-1", orderNumber: "P-087", recipeName: "Medialunas de Manteca", recipeVersion: "v2.1", locationName: "Depósito Central", plannedQty: 300, actualQty: undefined, status: "in_progress", estimatedCost: 82350, actualCost: undefined, unitCost: 274.5, plannedDate: "2026-02-11", startedAt: "2026-02-11T07:30:00Z", createdBy: "Carlos Gómez", aiSuggested: false },
  { id: "po-2", orderNumber: "P-086", recipeName: "Pan Lactal", recipeVersion: "v1.3", locationName: "Depósito Central", plannedQty: 50, status: "pending", estimatedCost: 28000, unitCost: 560, plannedDate: "2026-02-11", createdBy: "Carlos Gómez", aiSuggested: true },
  { id: "po-3", orderNumber: "P-085", recipeName: "Torta de Chocolate", recipeVersion: "v3.0", locationName: "Depósito Central", plannedQty: 8, status: "pending", estimatedCost: 42000, unitCost: 5250, plannedDate: "2026-02-11", createdBy: "Carlos Gómez", aiSuggested: false },
  { id: "po-4", orderNumber: "P-084", recipeName: "Medialunas de Manteca", recipeVersion: "v2.1", locationName: "Depósito Central", plannedQty: 200, actualQty: 195, status: "completed", estimatedCost: 54900, actualCost: 56200, unitCost: 288.2, plannedDate: "2026-02-11", startedAt: "2026-02-11T05:00:00Z", completedAt: "2026-02-11T07:15:00Z", createdBy: "Carlos Gómez", aiSuggested: true },
  { id: "po-5", orderNumber: "P-083", recipeName: "Budín de Pan", recipeVersion: "v1.0", locationName: "Depósito Central", plannedQty: 20, actualQty: 20, status: "completed", estimatedCost: 18000, actualCost: 17500, unitCost: 875, plannedDate: "2026-02-10", startedAt: "2026-02-10T06:00:00Z", completedAt: "2026-02-10T08:30:00Z", createdBy: "Carlos Gómez", aiSuggested: false },
]

// Shipments
export const shipments: Shipment[] = [
  {
    id: "shp-1", shipmentNumber: "ENV-2026-0211-001",
    origin: locations[0], destination: locations[1],
    status: "in_transit", totalItems: 4,
    estimatedArrival: "2026-02-11T10:30:00Z",
    dispatchedAt: "2026-02-11T09:15:00Z",
    createdBy: "Juan Pérez", createdAt: "2026-02-11T08:00:00Z",
    items: [
      { productId: "prod-1", productName: "Harina 000 x25Kg", sentQty: 50 },
      { productId: "prod-2", productName: "Leche Entera 1L", sentQty: 48 },
      { productId: "prod-8", productName: "Medialuna de Manteca", sentQty: 150 },
      { productId: "prod-3", productName: "Café Grano Colombia 1Kg", sentQty: 10 },
    ]
  },
  {
    id: "shp-2", shipmentNumber: "ENV-2026-0211-002",
    origin: locations[0], destination: locations[2],
    status: "delivered", totalItems: 3,
    dispatchedAt: "2026-02-11T08:00:00Z",
    createdBy: "Juan Pérez", createdAt: "2026-02-11T07:30:00Z",
    items: [
      { productId: "prod-1", productName: "Harina 000 x25Kg", sentQty: 30, receivedQty: 30, difference: 0 },
      { productId: "prod-5", productName: "Manteca x5Kg", sentQty: 10, receivedQty: 10, difference: 0 },
      { productId: "prod-8", productName: "Medialuna de Manteca", sentQty: 100, receivedQty: 98, difference: -2, diffReason: "Rotura en transporte" },
    ]
  },
  {
    id: "shp-3", shipmentNumber: "ENV-2026-0210-008",
    origin: locations[0], destination: locations[3],
    status: "closed", totalItems: 2,
    dispatchedAt: "2026-02-10T09:00:00Z",
    receivedAt: "2026-02-10T10:30:00Z",
    createdBy: "Juan Pérez", createdAt: "2026-02-10T08:00:00Z",
    items: [
      { productId: "prod-3", productName: "Café Grano Colombia 1Kg", sentQty: 5, receivedQty: 5, difference: 0 },
      { productId: "prod-8", productName: "Medialuna de Manteca", sentQty: 50, receivedQty: 50, difference: 0 },
    ]
  },
]

// Goods Receipts
export const goodsReceipts: GoodsReceipt[] = [
  { id: "gr-1", receiptNumber: "ING-2026-042", supplier: suppliers[0], location: locations[0], invoiceNumber: "FC-A-0001-00045832", invoiceDate: "2026-02-11", method: "ocr", ocrConfidence: 94.2, status: "confirmed", totalAmount: 487500, itemsCount: 4, itemsWithDiff: 2, userName: "Juan Pérez", createdAt: "2026-02-11T09:45:00Z" },
  { id: "gr-2", receiptNumber: "ING-2026-041", supplier: suppliers[1], location: locations[0], invoiceNumber: "FC-A-0002-00012345", invoiceDate: "2026-02-10", method: "manual", status: "confirmed", totalAmount: 360000, itemsCount: 3, itemsWithDiff: 0, userName: "Juan Pérez", createdAt: "2026-02-10T10:00:00Z" },
  { id: "gr-3", receiptNumber: "ING-2026-040", supplier: suppliers[2], location: locations[0], invoiceNumber: "FC-B-0003-00078901", invoiceDate: "2026-02-09", method: "manual", status: "confirmed", totalAmount: 125000, itemsCount: 5, itemsWithDiff: 1, userName: "María López", createdAt: "2026-02-09T11:30:00Z" },
]

// Tables for Café Norte
export const tables: TableInfo[] = [
  { id: "t-1", name: "M1", zone: "Salón Principal", capacity: 4, status: "available", positionX: 0, positionY: 0 },
  { id: "t-2", name: "M2", zone: "Salón Principal", capacity: 4, status: "occupied", currentOrderId: "ord-1", customerCount: 4, occupiedMinutes: 45, positionX: 1, positionY: 0 },
  { id: "t-3", name: "M3", zone: "Salón Principal", capacity: 2, status: "available", positionX: 2, positionY: 0 },
  { id: "t-4", name: "M4", zone: "Salón Principal", capacity: 2, status: "ordering", customerCount: 2, occupiedMinutes: 5, positionX: 3, positionY: 0 },
  { id: "t-5", name: "M5", zone: "Salón Principal", capacity: 4, status: "occupied", currentOrderId: "ord-2", customerCount: 3, occupiedMinutes: 20, positionX: 4, positionY: 0 },
  { id: "t-6", name: "T1", zone: "Terraza", capacity: 4, status: "occupied", customerCount: 2, occupiedMinutes: 35, positionX: 0, positionY: 1 },
  { id: "t-7", name: "T2", zone: "Terraza", capacity: 4, status: "available", positionX: 1, positionY: 1 },
  { id: "t-8", name: "T3", zone: "Terraza", capacity: 4, status: "available", positionX: 2, positionY: 1 },
  { id: "t-9", name: "T4", zone: "Terraza", capacity: 6, status: "occupied", customerCount: 6, occupiedMinutes: 55, positionX: 3, positionY: 1 },
  { id: "t-10", name: "B1", zone: "Barra", capacity: 1, status: "occupied", customerCount: 1, occupiedMinutes: 15, positionX: 0, positionY: 2 },
  { id: "t-11", name: "B2", zone: "Barra", capacity: 1, status: "available", positionX: 1, positionY: 2 },
  { id: "t-12", name: "B3", zone: "Barra", capacity: 1, status: "occupied", customerCount: 1, occupiedMinutes: 10, positionX: 2, positionY: 2 },
  { id: "t-13", name: "B4", zone: "Barra", capacity: 1, status: "available", positionX: 3, positionY: 2 },
]

// Dashboard KPIs
export const dashboardKPIs: DashboardKPIs = {
  stockCritical: 12,
  productionPending: 3,
  movementsToday: 847,
  aiAlerts: 5,
  salesToday: 2847500,
  salesYesterday: 2635000,
  ordersToday: 156,
  activeLocations: 3,
  totalLocations: 4,
}

// AI Events
export const aiEvents: AIEvent[] = [
  { id: "ai-1", type: "purchase_suggestion", severity: "warning", title: "Harina 000: pedir antes del viernes", description: "Al ritmo actual, el stock de Harina en Café Norte se agota en 2 días. Sugerencia: enviar 50 Kg desde Depósito.", status: "active", createdAt: "2026-02-11T06:00:00Z" },
  { id: "ai-2", type: "anomaly_detection", severity: "warning", title: "Leche: consumo 20% mayor al esperado", description: "El consumo de leche en Restaurante Sur es 20% mayor al promedio para un martes. Verificar si hay promoción activa.", status: "active", createdAt: "2026-02-11T06:15:00Z" },
  { id: "ai-3", type: "stock_prediction", severity: "info", title: "Café grano alcanza hasta el miércoles", description: "Proyección: el stock de Café Grano en Express Centro alcanza hasta el miércoles 13/02.", status: "active", createdAt: "2026-02-11T06:00:00Z" },
  { id: "ai-4", type: "production_suggestion", severity: "info", title: "Producir 350 medialunas para mañana", description: "Basado en demanda histórica de jueves: producir 350 Medialunas, 40 Pan Lactal, 200 Facturas.", status: "active", createdAt: "2026-02-11T05:00:00Z" },
  { id: "ai-5", type: "anomaly_detection", severity: "critical", title: "Anomalía en consumo de azúcar", description: "Consumo de azúcar en Café Norte es 85% mayor al esperado. Consumo esperado: 5.2 Kg, real: 9.6 Kg.", status: "active", createdAt: "2026-02-11T08:50:00Z" },
]

// Alerts
export const alerts: Alert[] = [
  { id: "alrt-1", type: "stock_critical", priority: "high", title: "Stock Crítico: Medialuna de Manteca", message: "Medialuna de Manteca en Café Norte: 28 (mínimo: 50)", locationName: "Café Norte", status: "active", createdAt: "2026-02-11T09:00:00Z" },
  { id: "alrt-2", type: "stock_critical", priority: "high", title: "Stock Crítico: Manteca x5Kg", message: "Manteca en Café Norte: 5 Kg (mínimo: 8 Kg)", locationName: "Café Norte", status: "active", createdAt: "2026-02-11T08:30:00Z" },
  { id: "alrt-3", type: "location_offline", priority: "critical", title: "Express Centro sin conexión", message: "Express Centro lleva 15 minutos sin conexión. Última señal: 11:24 AM", locationName: "Express Centro", status: "active", createdAt: "2026-02-11T09:39:00Z" },
  { id: "alrt-4", type: "correction_pending", priority: "medium", title: "Corrección pendiente de aprobación", message: "+5 Medialunas por error de conteo (María López)", locationName: "Café Norte", status: "active", createdAt: "2026-02-11T09:45:00Z" },
]

// Activity items
export const recentActivity: ActivityItem[] = [
  { id: "act-1", time: "2026-02-11T09:45:00Z", description: "Ingresó mercadería de Molinos del Sur ($487.500)", type: "receipt", userName: "Juan Pérez" },
  { id: "act-2", time: "2026-02-11T09:32:00Z", description: "Producción #P-084 completada (Medialunas x195)", type: "production", userName: "Carlos Gómez" },
  { id: "act-3", time: "2026-02-11T09:15:00Z", description: "Envío #ENV-001 despachado a Café Norte", type: "shipment", userName: "Juan Pérez" },
  { id: "act-4", time: "2026-02-11T08:50:00Z", description: "Alerta IA: anomalía en consumo de azúcar", type: "ai", userName: "Sistema IA" },
  { id: "act-5", time: "2026-02-11T08:30:00Z", description: "Abrió caja en Restaurante Sur", type: "cash", userName: "María López" },
  { id: "act-6", time: "2026-02-11T08:15:00Z", description: "Corrección: +5 Medialunas (error de conteo)", type: "correction", userName: "María López" },
  { id: "act-7", time: "2026-02-11T08:00:00Z", description: "Abrió caja en Café Norte", type: "cash", userName: "Pedro Sánchez" },
  { id: "act-8", time: "2026-02-11T07:30:00Z", description: "Inició producción #P-087 (Medialunas x300)", type: "production", userName: "Carlos Gómez" },
]

// Sales data for charts
export const salesByDay = [
  { day: "Lun", current: 2340000, previous: 2100000 },
  { day: "Mar", current: 2680000, previous: 2450000 },
  { day: "Mié", current: 2520000, previous: 2380000 },
  { day: "Jue", current: 2890000, previous: 2700000 },
  { day: "Vie", current: 3150000, previous: 2980000 },
  { day: "Sáb", current: 2420000, previous: 2250000 },
  { day: "Dom", current: 2450000, previous: 2150000 },
]

export const salesByLocation = [
  { name: "Café Norte", value: 8200000, orders: 312, color: "#2563EB" },
  { name: "Restaurante Sur", value: 7100000, orders: 198, color: "#7C3AED" },
  { name: "Express Centro", value: 3150000, orders: 445, color: "#06B6D4" },
]

// Stock movements
export const stockMovements: StockMovement[] = [
  { id: "sm-1", productName: "Harina 000 x25Kg", productSku: "HAR-001", locationName: "Depósito Central", type: "production_out", quantity: -12, userName: "Carlos Gómez", createdAt: "2026-02-11T09:45:00Z", reference: "Producción #P-084" },
  { id: "sm-2", productName: "Harina 000 x25Kg", productSku: "HAR-001", locationName: "Depósito Central", type: "goods_receipt", quantity: 250, unitCost: 2450, userName: "Juan Pérez", createdAt: "2026-02-10T10:00:00Z", reference: "Ingreso #ING-042" },
  { id: "sm-3", productName: "Harina 000 x25Kg", productSku: "HAR-001", locationName: "Café Norte", type: "shipment_in", quantity: 50, userName: "María López", createdAt: "2026-02-10T11:30:00Z", reference: "Envío #ENV-007" },
  { id: "sm-4", productName: "Leche Entera 1L", productSku: "LEC-001", locationName: "Depósito Central", type: "goods_receipt", quantity: 100, unitCost: 1200, userName: "Juan Pérez", createdAt: "2026-02-10T10:00:00Z", reference: "Ingreso #ING-041" },
  { id: "sm-5", productName: "Medialuna de Manteca", productSku: "MED-001", locationName: "Depósito Central", type: "production_in", quantity: 195, userName: "Carlos Gómez", createdAt: "2026-02-11T07:15:00Z", reference: "Producción #P-084" },
]
