"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { sileo } from "sileo"
import {
  Search,
  CreditCard,
  Building2,
  ChevronRight,
  Loader2,
  Calendar,
  DollarSign,
  FileText,
  X,
  Upload,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"
import { paymentOrdersApi } from "@/lib/api/payment-orders"
import { suppliersApi } from "@/lib/api/suppliers"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendiente", bg: "bg-amber-50", text: "text-amber-700" },
  paid: { label: "Pagada", bg: "bg-green-50", text: "text-green-700" },
  cancelled: { label: "Cancelada", bg: "bg-gray-100", text: "text-gray-600" },
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100">
                {Array.from({ length: 6 }).map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: "70%" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PaymentOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUploading, setProofUploading] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)

  const apiBase = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "") : ""

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {}
      if (selectedStatus) params.status = selectedStatus
      if (selectedSupplier) params.supplierId = selectedSupplier
      const res = await paymentOrdersApi.getAll(params)
      const data = (res as any).data ?? []
      const tot = (res as any).total ?? 0
      setOrders(data)
      setTotal(tot)
    } catch (err: any) {
      const msg = err.message || "Error al cargar órdenes de pago"
      setError(msg)
      setOrders([])
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedSupplier])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    suppliersApi.getAll({ limit: 200 }).then((r: any) => {
      const d = r.data ?? r ?? []
      setSuppliers(Array.isArray(d) ? d.map((s: any) => ({ id: s.id, name: s.name })) : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!detailId) {
      setDetailOrder(null)
      setProofFile(null)
      setProofError(null)
      return
    }
    setDetailLoading(true)
    paymentOrdersApi.getById(detailId).then(setDetailOrder).catch(() => setDetailOrder(null)).finally(() => setDetailLoading(false))
  }, [detailId])

  const handleMarkAsPaid = () => {
    if (!detailId || detailOrder?.status === "paid") return
    setPayLoading(true)
    paymentOrdersApi
      .markAsPaid(detailId)
      .then((updated) => {
        setDetailOrder(updated)
        fetchOrders()
        sileo.success({ title: "Orden marcada como pagada" })
      })
      .catch((err) => sileo.error({ title: err?.message ?? "Error al marcar como pagada" }))
      .finally(() => setPayLoading(false))
  }

  const handleUploadProof = () => {
    if (!detailId || !proofFile) return
    setProofUploading(true)
    setProofError(null)
    paymentOrdersApi
      .uploadPaymentProof(detailId, proofFile)
      .then((updated) => {
        setDetailOrder(updated)
        setProofFile(null)
        fetchOrders()
        sileo.success({ title: "Comprobante subido correctamente" })
      })
      .catch((err) => {
        const msg = err.message || "Error al subir"
        setProofError(msg)
        sileo.error({ title: msg })
      })
      .finally(() => setProofUploading(false))
  }

  const filtered = searchQuery
    ? orders.filter(
        (o) =>
          o.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(o.amount).includes(searchQuery)
      )
    : orders

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de pago</h1>
        <p className="mt-1 text-sm text-gray-500">
          Órdenes generadas al confirmar ingresos de mercadería
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por proveedor, factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por estado"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagada</option>
            <option value="cancelled">Cancelada</option>
          </select>
          <select
            aria-label="Filtrar por proveedor"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-white">Proveedor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-white">Factura</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-white">Monto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-white">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-white">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-white">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-white">
                      No hay órdenes de pago
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => {
                    const cfg = statusConfig[order.status] || statusConfig.pending
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-gray-100 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {order.supplier?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-white">
                          {order.invoiceNumber ?? order.goodsReceipt?.invoiceNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                          {formatCurrency(order.amount ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-white">
                          {order.dueDate ? formatDate(order.dueDate) : order.createdAt ? formatDate(order.createdAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDetailId(order.id)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            Ver <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal detalle factura */}
      {detailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de la factura</h2>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : detailOrder ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:flex sm:flex-wrap sm:gap-4">
                    <div>
                      <span className="text-gray-500 dark:text-white">Proveedor</span>
                      <p className="font-medium text-gray-900 dark:text-white">{detailOrder.supplier?.name ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-white">Factura</span>
                      <p className="font-medium text-gray-900 dark:text-white">{detailOrder.invoiceNumber ?? detailOrder.goodsReceipt?.invoiceNumber ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-white">Fecha</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {detailOrder.goodsReceipt?.invoiceDate
                          ? formatDate(detailOrder.goodsReceipt.invoiceDate)
                          : detailOrder.goodsReceipt?.createdAt
                            ? formatDate(detailOrder.goodsReceipt.createdAt)
                            : detailOrder.dueDate
                              ? formatDate(detailOrder.dueDate)
                              : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-white">Total</span>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(detailOrder.amount ?? 0)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-white">Estado pago</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", (statusConfig[detailOrder.status] || statusConfig.pending).bg, (statusConfig[detailOrder.status] || statusConfig.pending).text)}>
                        {(statusConfig[detailOrder.status] || statusConfig.pending).label}
                      </span>
                    </div>
                  </div>

                  {detailOrder.goodsReceipt?.items?.length > 0 ? (
                    <>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-700">Ítems de la factura</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-white">Producto</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-white">Cant.</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-white">P. unit.</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-white">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailOrder.goodsReceipt.items.map((item: any) => {
                              const qty = item.receivedQty ?? item.orderedQty ?? 0
                              const unitCost = item.unitCost ?? 0
                              const subtotal = qty * unitCost
                              return (
                                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                                    {item.product?.name ?? "—"}
                                    {item.product?.sku && <span className="ml-1 text-gray-500 dark:text-gray-400 text-xs">({item.product.sku})</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-white">
                                    {qty} {item.product?.unit ?? ""}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-white">{formatCurrency(unitCost)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-white">
                        Ingreso: {detailOrder.goodsReceipt.receiptNumber ?? detailOrder.goodsReceipt.id}
                        {detailOrder.goodsReceipt.location?.name && ` · ${detailOrder.goodsReceipt.location.name}`}
                      </p>
                    </>
                  ) : detailOrder.goodsReceipt ? (
                    <div className="rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
                      Esta factura no tiene ítems cargados. Ingreso: {detailOrder.goodsReceipt.receiptNumber ?? detailOrder.goodsReceipt.id}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                      No hay ingreso asociado; solo se muestra la orden de pago. Monto: {formatCurrency(detailOrder.amount ?? 0)}.
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3">Pago</h3>
                    {detailOrder.status === "paid" ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-900/40 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-200">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pagado
                        </span>
                        {detailOrder.paymentProofPath && (
                          <a
                            href={`${apiBase}/uploads/${detailOrder.paymentProofPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Ver comprobante <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2">
                          Para marcar como pagada primero debe cargar el comprobante de pago (subir archivo abajo).
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleMarkAsPaid}
                            disabled={payLoading || !detailOrder?.paymentProofPath}
                            title={!detailOrder?.paymentProofPath ? "Cargue el comprobante de pago primero" : undefined}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Marcar como pagado
                          </button>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                          <p className="text-xs font-medium text-gray-600 dark:text-white mb-2">Comprobante de pago</p>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 has-[:focus]:ring-2 has-[:focus]:ring-blue-500 has-[:focus]:ring-offset-1 dark:has-[:focus]:ring-offset-gray-800">
                              <span className="shrink-0 font-medium text-blue-600 dark:text-blue-400">Elegir archivo</span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                aria-label="Seleccionar comprobante de pago (PDF o imagen)"
                                className="sr-only"
                                onChange={(e) => {
                                  setProofFile(e.target.files?.[0] ?? null)
                                  setProofError(null)
                                }}
                              />
                              <span className="min-w-0 truncate text-gray-500 dark:text-gray-400">
                                {proofFile ? proofFile.name : "Ningún archivo seleccionado"}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={handleUploadProof}
                              disabled={!proofFile || proofUploading}
                              className={cn(
                                "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                                proofFile && !proofUploading
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 opacity-70 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                              )}
                            >
                              {proofUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              Subir comprobante
                            </button>
                          </div>
                          {proofError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{proofError}</p>}
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Al subir el comprobante, la orden se marcará como pagada.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-gray-500 dark:text-white">No se pudo cargar el detalle.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
