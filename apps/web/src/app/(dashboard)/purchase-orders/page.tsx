"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { sileo } from "sileo"
import {
  PackagePlus,
  Loader2,
  Warehouse,
  ShoppingCart,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Building2,
  AlertTriangle,
} from "lucide-react"
import { locationsApi } from "@/lib/api/locations"
import { purchaseOrdersApi } from "@/lib/api/purchase-orders"
import { stockApi } from "@/lib/api/stock"
import { cn, formatCurrency } from "@/lib/utils"

type StockSummaryRow = {
  id: string
  productId: string
  product: {
    id: string
    name: string
    sku: string | null
    unit: string
    avgCost: number
    category?: { name: string } | null
    productSuppliers?: Array<{ supplier: { id: string; name: string } }>
  }
  locationId: string
  location: { id: string; name: string; type: string }
  quantity: number
  minQuantity: number
  maxQuantity: number | null
  status: "critical" | "medium" | "normal"
  suggestedOrderQty: number
  soldLast7Days: number
  soldLast30Days: number
  suggestedOrderQtyByDemand: number
}

const stockStatusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  critical: {
    label: "Crítico",
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
  medium: {
    label: "Bajo",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  normal: {
    label: "Normal",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
}

const priceStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ok: { label: "Precio OK", bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-300" },
  expensive: { label: "Más caro", bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-800 dark:text-red-200" },
  cheap: { label: "Más barato", bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-800 dark:text-green-200" },
}

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  placed: "Pedido realizado",
  confirmed: "Confirmado",
  received: "Recibido",
  approved_payment: "Aprobado / Pagado",
}

export default function PurchaseOrdersPage() {
  const [locations, setLocations] = useState<any[]>([])
  const [depotId, setDepotId] = useState("")
  const [activeTab, setActiveTab] = useState<"demand" | "orders">("demand")
  const [demandSummary, setDemandSummary] = useState<any>(null)
  const [loadingDemand, setLoadingDemand] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [filterStatus, setFilterStatus] = useState("")
  const [stockSummaryRows, setStockSummaryRows] = useState<StockSummaryRow[]>([])
  const [loadingStockSummary, setLoadingStockSummary] = useState(false)
  const [showFaltantesTable, setShowFaltantesTable] = useState(false)

  useEffect(() => {
    locationsApi.getAll().then((res) => {
      const list = Array.isArray(res) ? res : (res as any)?.data ?? []
      setLocations(list)
      const depot = list.find((l: any) => l.type === "WAREHOUSE")
      if (depot && !depotId) setDepotId(depot.id)
    }).catch(() => {})
  }, [])

  const loadStockSummary = useCallback(async () => {
    if (!depotId) return
    setLoadingStockSummary(true)
    try {
      const data = await stockApi.getLogisticsSummary(depotId)
      const rows = Array.isArray(data) ? data : []
      const bajoOCritico = rows.filter(
        (r: StockSummaryRow) => r.status === "critical" || r.status === "medium"
      )
      setStockSummaryRows(bajoOCritico)
    } catch {
      setStockSummaryRows([])
    } finally {
      setLoadingStockSummary(false)
    }
  }, [depotId])

  useEffect(() => {
    if (!depotId) return
    setShowFaltantesTable(false)
    setStockSummaryRows([])
    setDemandSummary(null)
  }, [depotId])

  const handleVerFaltantesPorProveedor = useCallback(async () => {
    if (!depotId) return
    setShowFaltantesTable(true)
    setDemandSummary(null)
    setStockSummaryRows([])
    setLoadingStockSummary(true)
    setLoadingDemand(true)
    try {
      const [stockData, demandData] = await Promise.all([
        stockApi.getLogisticsSummary(depotId),
        purchaseOrdersApi.getDemandSummary(depotId).catch((err: any) => {
          sileo.error({ title: err?.message ?? "Error al cargar demanda" })
          return null
        }),
      ])
      const rows = Array.isArray(stockData) ? stockData : []
      setStockSummaryRows(rows.filter((r: StockSummaryRow) => r.status === "critical" || r.status === "medium"))
      if (demandData) setDemandSummary(demandData)
    } finally {
      setLoadingStockSummary(false)
      setLoadingDemand(false)
    }
  }, [depotId])

  const loadDemandSummary = useCallback(async () => {
    if (!depotId) return
    setLoadingDemand(true)
    setDemandSummary(null)
    try {
      const data = await purchaseOrdersApi.getDemandSummary(depotId)
      setDemandSummary(data)
    } catch (err: any) {
      sileo.error({ title: err?.message ?? "Error al cargar resumen de demanda" })
    } finally {
      setLoadingDemand(false)
    }
  }, [depotId])

  const handleGenerateOrders = async () => {
    if (!depotId) return
    setGenerating(true)
    try {
      const created = await purchaseOrdersApi.generateFromDemand({ locationId: depotId })
      sileo.success({ title: `Se generaron ${created?.length ?? 0} orden(es) de compra en borrador` })
      setActiveTab("orders")
      setDemandSummary(null)
      loadOrders()
    } catch (err: any) {
      sileo.error({ title: err?.message ?? "Error al generar órdenes" })
    } finally {
      setGenerating(false)
    }
  }

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await purchaseOrdersApi.getAll({
        locationId: depotId || undefined,
        status: filterStatus || undefined,
        limit: 50,
      })
      const data = (res as any)?.data ?? []
      const total = (res as any)?.total ?? 0
      setOrders(data)
      setOrdersTotal(total)
    } catch {
      setOrders([])
      setOrdersTotal(0)
    } finally {
      setLoadingOrders(false)
    }
  }, [depotId, filterStatus])

  useEffect(() => {
    if (activeTab === "orders" && (depotId || filterStatus !== undefined)) loadOrders()
  }, [activeTab, loadOrders])

  const depotOptions = locations.filter((l: any) => l.type === "WAREHOUSE")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pedidos/Compras
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Stock del depósito y sugerencia de pedido según mínimo y máximo. Base para reponer por demanda (como Resumen para logística). Solo depósito; no se incluyen locales.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generá una orden de pedido con detalle por <strong>rubro y artículos</strong> (faltantes a proveedores) e indicación si comprás <strong>caro o barato</strong>.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Proceso: 1) Generar orden de pedido → 2) Hacer el pedido → 3) Confirmación de pedido realizado → 4) Recepción de pedido → 5) Aprobación y pago.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Depósito
          </label>
          <select
            value={depotId}
            onChange={(e) => setDepotId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm min-w-[200px]"
            aria-label="Seleccionar depósito"
          >
            <option value="">Seleccionar depósito</option>
            {depotOptions.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-6">
          <button
            type="button"
            onClick={() => setActiveTab("demand")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "demand"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Por demanda
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "orders"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Órdenes
          </button>
        </div>
        {activeTab === "orders" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Estado
            </label>
            <select
              aria-label="Filtrar por estado"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="placed">Pedido realizado</option>
              <option value="confirmed">Confirmado</option>
              <option value="received">Recibido</option>
              <option value="approved_payment">Aprobado / Pagado</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === "demand" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
              Productos del depósito en nivel <strong>crítico o medio</strong>. Base para reponer por demanda.
            </p>
            <button
              type="button"
              onClick={handleVerFaltantesPorProveedor}
              disabled={!depotId || loadingStockSummary}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingStockSummary && showFaltantesTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              Ver faltantes por proveedor
            </button>
          </div>

          {/* Una sola lista: stock (crítico/medio) + detalle por proveedor (rubro, artículos, caro/barato) */}
          {depotId && showFaltantesTable && (
            <>
              {(loadingStockSummary || loadingDemand) ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : stockSummaryRows.length > 0 ? (
                <div className="space-y-8">
                  {/* Productos con proveedor (demand summary) */}
                  {demandSummary?.bySupplier?.map((group: any) => {
                    const stockByProductId = new Map(stockSummaryRows.map((r) => [r.productId, r]))
                    return (
                      <div
                        key={group.supplier.id}
                        className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {group.supplier.name}
                              {group.supplier.rubro && (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                  · {group.supplier.rubro}
                                </span>
                              )}
                            </h2>
                          </div>
                          <span className="rounded-full bg-gray-200 dark:bg-gray-600 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                            {group.items.length} producto{group.items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1000px] text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                <th className="px-4 py-3">Rubro</th>
                                <th className="px-4 py-3">Artículo</th>
                                <th className="px-4 py-3 text-right">Actual</th>
                                <th className="px-4 py-3 text-right">Mín.</th>
                                <th className="px-4 py-3 text-right">Máx.</th>
                                <th className="px-4 py-3 text-right">Ventas 7d</th>
                                <th className="px-4 py-3 text-right">Ventas 30d</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Sug. (mín/máx)</th>
                                <th className="px-4 py-3 text-right">Sug. (por demanda)</th>
                                <th className="px-4 py-3 text-right">Cantidad</th>
                                <th className="px-4 py-3 text-right">Precio lista</th>
                                <th className="px-4 py-3 text-right">Último precio</th>
                                <th className="px-4 py-3">Comprando (caro/barato)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {group.items.map((item: any, idx: number) => {
                                const stock = stockByProductId.get(item.productId)
                                const config = stockStatusConfig[stock?.status ?? "normal"] ?? stockStatusConfig.normal
                                const ps = priceStatusConfig[item.priceStatus] ?? priceStatusConfig.ok
                                return (
                                  <tr key={`${item.productId}-${idx}`} className="text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.categoryName}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                                      {item.sku && <p className="text-xs text-gray-500 dark:text-gray-400">{item.sku} · {item.unit}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                                      {stock != null ? Number(stock.quantity).toLocaleString("es-AR") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                      {stock != null ? Number(stock.minQuantity).toLocaleString("es-AR") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                      {stock?.maxQuantity != null ? Number(stock.maxQuantity).toLocaleString("es-AR") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                      {(stock?.soldLast7Days ?? 0) > 0 ? Number(stock.soldLast7Days).toLocaleString("es-AR") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                      {(stock?.soldLast30Days ?? 0) > 0 ? Number(stock.soldLast30Days).toLocaleString("es-AR") : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                      {stock ? (
                                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.bg, config.text)}>
                                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                                          {config.label}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {stock && stock.suggestedOrderQty > 0 ? (
                                        <span className="tabular-nums text-blue-700 dark:text-blue-300">
                                          {Number(stock.suggestedOrderQty).toLocaleString("es-AR")} {item.unit}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {stock && stock.suggestedOrderQtyByDemand > 0 ? (
                                        <span className="inline-flex items-center gap-1 tabular-nums text-violet-700 dark:text-violet-300" title="Por demanda">
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          {Number(stock.suggestedOrderQtyByDemand).toLocaleString("es-AR")} {item.unit}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-medium">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unitCost)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                      {item.lastKnownCost != null ? formatCurrency(item.lastKnownCost) : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", ps.bg, ps.text)}>
                                        {item.priceStatus === "expensive" && <TrendingUp className="h-3 w-3" />}
                                        {item.priceStatus === "cheap" && <TrendingDown className="h-3 w-3" />}
                                        {item.priceStatus === "ok" && <Minus className="h-3 w-3" />}
                                        {ps.label}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}

                  {/* Todos los productos en crítico o medio: los que no tienen proveedor en la demanda */}
                  {(() => {
                    const productIdsInDemand = new Set(
                      (demandSummary?.bySupplier ?? []).flatMap((g: any) => g.items.map((i: any) => i.productId))
                    )
                    const rowsSinProveedor = stockSummaryRows.filter((r) => !productIdsInDemand.has(r.productId))
                    if (rowsSinProveedor.length === 0) return null
                    const esSoloBlock = rowsSinProveedor.length === stockSummaryRows.length
                    return (
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {esSoloBlock ? "Todos los productos del depósito (crítico o medio)" : "Resto del depósito (crítico o medio, sin proveedor en esta demanda)"}
                            </h2>
                          </div>
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                            {rowsSinProveedor.length} producto{rowsSinProveedor.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1000px] text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                <th className="px-4 py-3">Rubro</th>
                                <th className="px-4 py-3">Artículo</th>
                                <th className="px-4 py-3 text-right">Actual</th>
                                <th className="px-4 py-3 text-right">Mín.</th>
                                <th className="px-4 py-3 text-right">Máx.</th>
                                <th className="px-4 py-3 text-right">Ventas 7d</th>
                                <th className="px-4 py-3 text-right">Ventas 30d</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 text-right">Sug. (mín/máx)</th>
                                <th className="px-4 py-3 text-right">Sug. (por demanda)</th>
                                <th className="px-4 py-3 text-right">Cantidad</th>
                                <th className="px-4 py-3 text-right">Precio lista</th>
                                <th className="px-4 py-3 text-right">Último precio</th>
                                <th className="px-4 py-3">Comprando (caro/barato)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {rowsSinProveedor.map((row) => {
                                const config = stockStatusConfig[row.status] ?? stockStatusConfig.normal
                                const categoryName = (row.product as any)?.category?.name ?? null
                                return (
                                  <tr key={row.id} className="text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{categoryName ?? "—"}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-gray-900 dark:text-white">{row.product.name}</p>
                                      {row.product.sku && <p className="text-xs text-gray-500 dark:text-gray-400">{row.product.sku} · {row.product.unit}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-medium">{Number(row.quantity).toLocaleString("es-AR")}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{Number(row.minQuantity).toLocaleString("es-AR")}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.maxQuantity != null ? Number(row.maxQuantity).toLocaleString("es-AR") : "—"}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{(row.soldLast7Days ?? 0) > 0 ? Number(row.soldLast7Days).toLocaleString("es-AR") : "—"}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{(row.soldLast30Days ?? 0) > 0 ? Number(row.soldLast30Days).toLocaleString("es-AR") : "—"}</td>
                                    <td className="px-4 py-3">
                                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.bg, config.text)}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                                        {config.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {row.suggestedOrderQty > 0 ? <span className="tabular-nums text-blue-700 dark:text-blue-300">{Number(row.suggestedOrderQty).toLocaleString("es-AR")} {row.product.unit}</span> : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {row.suggestedOrderQtyByDemand > 0 ? <span className="inline-flex items-center gap-1 tabular-nums text-violet-700 dark:text-violet-300"><AlertTriangle className="h-3.5 w-3.5" />{Number(row.suggestedOrderQtyByDemand).toLocaleString("es-AR")} {row.product.unit}</span> : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-400">—</td>
                                    <td className="px-4 py-3 text-right text-gray-400">—</td>
                                    <td className="px-4 py-3 text-right text-gray-400">—</td>
                                    <td className="px-4 py-3 text-gray-400">—</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Paso 1 del proceso · {stockSummaryRows.length} producto{stockSummaryRows.length !== 1 ? "s" : ""} en crítico o medio</span>
                    <button
                      type="button"
                      onClick={handleGenerateOrders}
                      disabled={generating || stockSummaryRows.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Generar orden de pedido
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
                  <PackagePlus className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    No hay productos en bajo o crítico en este depósito.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {loadingOrders ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No hay órdenes de compra para los filtros seleccionados.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((po: any) => (
                <li key={po.id}>
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                        <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{po.orderNumber}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {po.supplier?.name ?? "—"} · {po.location?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {statusLabel[po.status] ?? po.status}
                      </span>
                      {po.totalAmount != null && (
                        <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                          {formatCurrency(po.totalAmount)}
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
