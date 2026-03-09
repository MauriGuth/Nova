"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { sileo } from "sileo"
import {
  ClipboardList,
  Loader2,
  MapPin,
  Calendar,
  Eye,
  X,
  Package,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react"
import { stockReconciliationsApi } from "@/lib/api/stock-reconciliations"
import { locationsApi } from "@/lib/api/locations"
import { cn } from "@/lib/utils"

const SHIFT_LABELS: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  night: "Tarde",
  Noche: "Tarde", // backend puede enviar en español; solo Mañana o Tarde
}

export default function StockReconciliationsPage() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [locationId, setLocationId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await stockReconciliationsApi.getAll({
        locationId: locationId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20,
      })
      const payload = res as { data?: any[]; total?: number }
      setData(Array.isArray(payload?.data) ? payload.data : [])
      setTotal(payload?.total ?? 0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar informes"
      setError(msg)
      setData([])
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }, [locationId, dateFrom, dateTo, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    locationsApi.getAll().then((res) => {
      const list = Array.isArray(res) ? res : (res as any)?.data ?? []
      setLocations(list)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    setLoadingDetail(true)
    stockReconciliationsApi.getById(detailId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [detailId])

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Auditoría de stock
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Informes de micro balance (cierre de jornada) enviados por los locales. Faltantes y sobrantes para revisión con los responsables de turno.
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white">Filtros</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-white">Local</label>
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setPage(1) }}
              className="min-w-[180px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]"
              aria-label="Filtrar por local"
            >
              <option value="">Todos los locales</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-white">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]"
              aria-label="Fecha desde"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-white">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]"
              aria-label="Fecha hasta"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-2">No hay informes de micro balance en el período seleccionado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-white">
                      Fecha / Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-white">
                      Local
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-white">
                      Responsable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-white">
                      Turno
                    </th>
                    <th className="w-24 min-w-24 shrink-0 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {rec.submittedAt
                          ? new Date(rec.submittedAt).toLocaleString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-white">
                        {rec.location?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-white">
                        {rec.user
                          ? [rec.user.firstName, rec.user.lastName].filter(Boolean).join(" ") || rec.user.email
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-white">
                        {rec.shiftLabel ? SHIFT_LABELS[rec.shiftLabel] ?? rec.shiftLabel : "—"}
                      </td>
                      <td className="w-24 min-w-24 shrink-0 px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailId(rec.id)}
                          className="inline-flex items-center gap-1 rounded-lg p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {total} informe{total !== 1 ? "s" : ""} en total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle: faltantes / sobrantes */}
      {detailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalle del informe – Faltantes / Sobrantes
              </h2>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p><span className="text-gray-500 dark:text-gray-400">Local:</span> {detail.location?.name ?? "—"}</p>
                    <p><span className="text-gray-500 dark:text-gray-400">Responsable:</span>{" "}
                      {detail.user ? [detail.user.firstName, detail.user.lastName].filter(Boolean).join(" ") : "—"}
                    </p>
                    <p><span className="text-gray-500 dark:text-gray-400">Turno:</span>{" "}
                      {detail.shiftLabel ? SHIFT_LABELS[detail.shiftLabel] ?? detail.shiftLabel : "—"}
                    </p>
                    <p><span className="text-gray-500 dark:text-gray-400">Enviado:</span>{" "}
                      {detail.submittedAt
                        ? new Date(detail.submittedAt).toLocaleString("es-AR")
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                          <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Producto</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Esperado</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Contado</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(detail.items ?? []).map((item: any) => {
                          const diff = item.difference ?? (item.countedQuantity - item.expectedQuantity)
                          const isShortage = diff < 0
                          const isSurplus = diff > 0
                          return (
                            <tr key={item.id} className="text-gray-800 dark:text-gray-200">
                              <td className="px-3 py-2">
                                <span className="font-medium">{item.product?.name ?? item.productId}</span>
                                {item.product?.sku && (
                                  <span className="ml-1 text-gray-500 dark:text-gray-400">({item.product.sku})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{Number(item.expectedQuantity).toLocaleString("es-AR")}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{Number(item.countedQuantity).toLocaleString("es-AR")}</td>
                              <td className="px-3 py-2 text-right">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 tabular-nums",
                                    isShortage && "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
                                    isSurplus && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200",
                                    !isShortage && !isSurplus && "text-gray-500 dark:text-gray-400"
                                  )}
                                >
                                  {isShortage && <ArrowDownRight className="h-3.5 w-3.5" />}
                                  {isSurplus && <ArrowUpRight className="h-3.5 w-3.5" />}
                                  {diff > 0 ? "+" : ""}{Number(diff).toLocaleString("es-AR")}
                                  {isShortage && " (faltante)"}
                                  {isSurplus && " (sobrante)"}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No se pudo cargar el detalle.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
