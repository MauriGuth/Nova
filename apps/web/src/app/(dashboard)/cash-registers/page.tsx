"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"
import {
  Receipt,
  Loader2,
  MapPin,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileDown,
  Eye,
  CreditCard,
  Banknote,
  Building2,
  CheckCircle2,
} from "lucide-react"
import { cashRegistersApi } from "@/lib/api/cash-registers"
import { cashMovementsApi } from "@/lib/api/cash-movements"
import { locationsApi } from "@/lib/api/locations"
import { cn, formatCurrency, formatNumberInputDisplay, parseNumberInputInput } from "@/lib/utils"
import { FormattedNumberInput } from "@/components/ui/formatted-number-input"

const DIFF_PERCENT_YELLOW = 1
const DIFF_PERCENT_RED = 5

/** Denominaciones para conteo (billetes y monedas), de mayor a menor */
const DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]

function getDiffColor(diff: number, expected: number) {
  if (Math.abs(diff) < 0.01) return "text-green-600 dark:text-white dark:bg-green-900/50 bg-green-50"
  const exp = Math.abs(expected) < 0.01 ? 1 : expected
  const pct = (Math.abs(diff) / exp) * 100
  if (pct >= DIFF_PERCENT_RED) return "text-red-700 dark:text-white dark:bg-red-900/50 bg-red-50"
  if (pct >= DIFF_PERCENT_YELLOW) return "text-amber-700 dark:text-white dark:bg-amber-900/50 bg-amber-50"
  return "text-green-600 dark:text-white dark:bg-green-900/50 bg-green-50"
}

export default function CashRegistersPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [registers, setRegisters] = useState<any[]>([])
  const [currentOpen, setCurrentOpen] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"historial" | "cerrar" | "reportes">("historial")

  const [closeForm, setCloseForm] = useState({
    closingAmount: "",
    /** Cantidad por denominación: key = "10000", value = "2" */
    denominations: {} as Record<string, string>,
    closingCardsTotal: "",
    /** Total Transferencias + QR (un solo monto) */
    closingTransferQrTotal: "",
    notes: "",
    salesNoTicket: "",
    internalConsumption: "",
    shift: "afternoon",
  })
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const [movementForm, setMovementForm] = useState({
    type: "expense" as "expense" | "withdrawal" | "extra_income",
    amount: "",
    reason: "",
  })
  const [movementLoading, setMovementLoading] = useState(false)
  const [movementError, setMovementError] = useState<string | null>(null)

  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily")
  const [reportDateFrom, setReportDateFrom] = useState("")
  const [reportDateTo, setReportDateTo] = useState("")
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const fetchRegisters = useCallback(async () => {
    if (!selectedLocationId) {
      setRegisters([])
      setCurrentOpen(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [listRes, openRes] = await Promise.all([
        cashRegistersApi.getAll(selectedLocationId),
        cashRegistersApi.getCurrentOpen(selectedLocationId),
      ])
      const list = Array.isArray(listRes) ? listRes : (listRes as any)?.data ?? listRes ?? []
      setRegisters(list)
      setCurrentOpen(openRes && (openRes as any).id ? openRes : null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar"
      setError(msg)
      setRegisters([])
      setCurrentOpen(null)
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }, [selectedLocationId])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  useEffect(() => {
    locationsApi.getAll().then((res) => {
      const data = Array.isArray(res) ? res : (res as any)?.data ?? []
      setLocations(data)
      if (data.length > 0 && !selectedLocationId) setSelectedLocationId(data[0].id)
    }).catch(() => {})
  }, [])

  const totalFromDenominations = DENOMINATIONS.reduce((sum, d) => {
    const qty = parseInt(closeForm.denominations[String(d)] ?? "0", 10) || 0
    return sum + d * qty
  }, 0)
  const useDenominationsTotal = totalFromDenominations > 0
  const effectiveClosingAmount = useDenominationsTotal ? totalFromDenominations : parseFloat(closeForm.closingAmount) || 0

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOpen?.id) return
    const amount = useDenominationsTotal ? totalFromDenominations : parseFloat(closeForm.closingAmount)
    if (!Number.isFinite(amount) || amount < 0) return
    setCloseError(null)
    setCloseLoading(true)
    try {
      const denominationsPayload: Record<string, number> = {}
      if (useDenominationsTotal) {
        DENOMINATIONS.forEach((d) => {
          const qty = parseInt(closeForm.denominations[String(d)] ?? "0", 10) || 0
          if (qty > 0) denominationsPayload[String(d)] = qty
        })
      }
      await cashRegistersApi.close(currentOpen.id, {
        closingAmount: Math.round(amount * 100) / 100,
        ...(Object.keys(denominationsPayload).length > 0 ? { denominations: denominationsPayload } : {}),
        closingCardsTotal: closeForm.closingCardsTotal ? parseFloat(closeForm.closingCardsTotal) : undefined,
        closingTransferTotal: closeForm.closingTransferQrTotal ? parseFloat(closeForm.closingTransferQrTotal) : undefined,
        closingQrTotal: 0,
        notes: closeForm.notes || undefined,
        shift: closeForm.shift,
        salesNoTicket: closeForm.salesNoTicket ? parseFloat(closeForm.salesNoTicket) : undefined,
        internalConsumption: closeForm.internalConsumption ? parseFloat(closeForm.internalConsumption) : undefined,
      })
      const closedId = currentOpen.id
      setCloseForm({
        closingAmount: "",
        denominations: {},
        closingCardsTotal: "",
        closingTransferQrTotal: "",
        notes: "",
        salesNoTicket: "",
        internalConsumption: "",
        shift: "afternoon",
      })
      setCurrentOpen(null)
      await fetchRegisters()
      setActiveTab("historial")
      sileo.success({ title: "Caja cerrada correctamente" })
      router.push(`/cash-registers/${closedId}`)
    } catch (err: any) {
      const msg = err?.message ?? "Error al cerrar la caja"
      setCloseError(msg)
      sileo.error({ title: msg })
    } finally {
      setCloseLoading(false)
    }
  }

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(movementForm.amount)
    if (!selectedLocationId || !movementForm.amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setMovementError("Ingresá un monto mayor a 0.")
      return
    }
    setMovementError(null)
    setMovementLoading(true)
    try {
      await cashMovementsApi.create({
        locationId: selectedLocationId,
        type: movementForm.type,
        amount: amountNum,
        reason: movementForm.reason || undefined,
        cashRegisterId: currentOpen?.id,
      })
      setMovementForm({ type: "expense", amount: "", reason: "" })
      await fetchRegisters()
      sileo.success({ title: "Movimiento registrado" })
    } catch (err: any) {
      const msg = err?.message ?? "Error al registrar movimiento"
      setMovementError(msg)
      sileo.error({ title: msg })
    } finally {
      setMovementLoading(false)
    }
  }

  const handleLoadReport = async () => {
    if (!selectedLocationId || !reportDateFrom || !reportDateTo) return
    setReportLoading(true)
    setReportData(null)
    try {
      const data = await cashRegistersApi.getReport(
        selectedLocationId,
        reportType,
        reportDateFrom,
        reportDateTo
      )
      setReportData(data)
    } catch {
      setReportData(null)
    } finally {
      setReportLoading(false)
    }
  }

  const exportToCsv = () => {
    const closed = registers.filter((r: any) => r.status === "closed")
    if (closed.length === 0) return
    const headers = ["Fecha cierre", "Local", "Turno", "Ventas totales", "Efectivo", "Tarjetas", "Transferencias+QR", "Caja esperada", "Caja real", "Diferencia", "Órdenes"]
    const rows = closed.map((r: any) => {
      const tj = (r.salesDebit ?? 0) + (r.salesCredit ?? 0) + (r.salesCard ?? 0)
      const tqr = (r.salesTransfer ?? 0) + (r.salesQr ?? 0)
      return [
        r.closedAt ? new Date(r.closedAt).toISOString() : "",
        r.location?.name ?? "",
        r.shift ?? "",
        r.totalSales ?? 0,
        r.salesCash ?? 0,
        tj,
        tqr,
        r.expectedAmount ?? 0,
        r.closingAmount ?? 0,
        r.difference ?? 0,
        r.totalOrders ?? 0,
      ]
    })
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cierres-caja-${selectedLocationId}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const closedRegisters = registers.filter((r: any) => r.status === "closed")
  const opening = currentOpen?.openingAmount ?? 0
  const salesCash = currentOpen?.salesCash ?? 0
  const salesCard = currentOpen?.salesCard ?? 0
  const salesDebit = currentOpen?.salesDebit ?? 0
  const salesCredit = currentOpen?.salesCredit ?? 0
  const salesTransfer = currentOpen?.salesTransfer ?? 0
  const salesQr = currentOpen?.salesQr ?? 0
  const salesCards = salesDebit + salesCredit + salesCard
  const salesTransfQr = salesTransfer + salesQr
  const expenses = currentOpen?.totalCashExpenses ?? 0
  const withdrawals = currentOpen?.totalWithdrawals ?? 0
  const extraIncome = currentOpen?.totalExtraIncome ?? 0
  const expectedAmount = opening + salesCards + salesTransfQr + salesCash - expenses - withdrawals + extraIncome

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cierre de caja diario</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Registra y audita el cierre diario por local, turno y responsable
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Seleccionar local"
          >
            <option value="">Seleccionar local</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1">
          {(["historial", "cerrar", "reportes"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              {tab === "historial" ? "Historial" : tab === "cerrar" ? "Cerrar turno" : "Reportes"}
            </button>
          ))}
        </div>
        {closedRegisters.length > 0 && (
          <button
            type="button"
            onClick={exportToCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FileDown className="h-4 w-4" />
            Exportar CSV
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div>
      )}

      {activeTab === "historial" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
          ) : closedRegisters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Receipt className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-500" />
              <p className="text-sm">
                {selectedLocationId ? "No hay cierres para este local." : "Selecciona un local."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Fecha / Turno</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Local</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Ventas</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Por medio de pago</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Esperado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Contado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Diferencia</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Órdenes</th>
                    <th className="w-24 min-w-24 shrink-0 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRegisters.map((r: any) => {
                    const diff = r.difference ?? 0
                    const exp = r.expectedAmount ?? 0
                    const diffLabel =
                      Math.abs(diff) < 0.01 ? "Cuadre" : diff > 0 ? `Sobrante ${formatCurrency(diff)}` : `Faltante ${formatCurrency(Math.abs(diff))}`
                    const diffColorClass = getDiffColor(diff, exp)
                    return (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-300" />
                            {r.closedAt ? new Date(r.closedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—"}
                            {r.shift && (
                              <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-900 dark:text-white">
                                {r.shift === "morning" ? "Mañana" : "Tarde"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-white">{r.location?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(r.totalSales ?? 0)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {(() => {
                            const ef = r.salesCash ?? 0
                            const tj = (r.salesDebit ?? 0) + (r.salesCredit ?? 0) + (r.salesCard ?? 0)
                            const tqr = (r.salesTransfer ?? 0) + (r.salesQr ?? 0)
                            const any = ef > 0 || tj > 0 || tqr > 0
                            if (!any) return <span className="text-gray-400 dark:text-gray-500">—</span>
                            return (
                              <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                                {ef > 0 && <span>Ef. {formatCurrency(ef)}</span>}
                                {tj > 0 && <span>Tj. {formatCurrency(tj)}</span>}
                                {tqr > 0 && <span>T+QR {formatCurrency(tqr)}</span>}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-white">{formatCurrency(r.expectedAmount ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-white">{formatCurrency(r.closingAmount ?? 0)}</td>
                        <td className={cn("px-4 py-3 text-right text-sm font-medium tabular-nums rounded-md px-2 py-0.5 inline-block", diffColorClass)}>
                          {Math.abs(diff) < 0.01 ? <Minus className="inline h-4 w-4" /> : diff > 0 ? <ArrowUpRight className="inline h-4 w-4" /> : <ArrowDownRight className="inline h-4 w-4" />}
                          {" "}{diffLabel}
                        </td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums text-gray-600 dark:text-white">{r.totalOrders ?? 0}</td>
                        <td className="w-24 min-w-24 shrink-0 px-4 py-3 text-center">
                          <Link
                            href={`/cash-registers/${r.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "cerrar" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {currentOpen ? (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen del turno abierto</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-white">Caja abierta el {currentOpen.openedAt ? new Date(currentOpen.openedAt).toLocaleString("es-CL") : "—"}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">Saldo inicial</span>
                    <span className="tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(opening)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">+ Tarjetas</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(salesCards)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">+ Transferencias y QR</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(salesTransfQr)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">+ Ventas efectivo</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(salesCash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">− Gastos en efectivo</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">−{formatCurrency(expenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">− Retiros</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">−{formatCurrency(withdrawals)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-white">+ Ingresos extra</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">+{formatCurrency(extraIncome)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-semibold text-gray-900 dark:text-white">
                    <span>Caja esperada</span>
                    <span className="tabular-nums">{formatCurrency(Math.round(expectedAmount * 100) / 100)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white">
                    Fórmula: Saldo inicial + Tarjetas + Transferencias y QR + Efectivo − Gastos − Retiros + Ingresos extra
                  </p>
                </div>
                {/* Ventas por medio de pago: comparar vendido (sistema) vs declarado (lo que ingresa el cajero) */}
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">Ventas por medio de pago</h3>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Compare lo vendido en el sistema con lo que declara al cierre.</p>
                  <div className="space-y-2">
                    {(() => {
                      const declaredCards = parseFloat(closeForm.closingCardsTotal) || 0
                      const declaredTransfQr = parseFloat(closeForm.closingTransferQrTotal) || 0
                      const declaredCash = effectiveClosingAmount
                      const match = (a: number, b: number) => Math.abs(a - b) < 0.02
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-sm">
                            <CreditCard className="h-4 w-4 text-gray-400 dark:text-gray-300" />
                            <span className="text-gray-600 dark:text-white">Tarjetas</span>
                            <span className="tabular-nums text-gray-900 dark:text-white">Vendido: {formatCurrency(salesCards)}</span>
                            <span className="text-gray-400 dark:text-gray-500">·</span>
                            <span className="tabular-nums text-gray-700 dark:text-gray-300">Declarado: {formatCurrency(declaredCards)}</span>
                            {match(salesCards, declaredCards) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Coincide
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 text-xs">Diferencia: {formatCurrency(declaredCards - salesCards)}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-sm">
                            <Banknote className="h-4 w-4 text-gray-400 dark:text-gray-300" />
                            <span className="text-gray-600 dark:text-white">Efectivo</span>
                            <span className="tabular-nums text-gray-900 dark:text-white">Vendido: {formatCurrency(salesCash)}</span>
                            <span className="text-gray-400 dark:text-gray-500">·</span>
                            <span className="tabular-nums text-gray-700 dark:text-gray-300">Conteo: {formatCurrency(declaredCash)}</span>
                            {match(salesCash, declaredCash) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Coincide
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 text-xs">Diferencia: {formatCurrency(declaredCash - salesCash)}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-sm">
                            <Building2 className="h-4 w-4 text-gray-400 dark:text-gray-300" />
                            <span className="text-gray-600 dark:text-white">Transferencias + QR</span>
                            <span className="tabular-nums text-gray-900 dark:text-white">Vendido: {formatCurrency(salesTransfQr)}</span>
                            <span className="text-gray-400 dark:text-gray-500">·</span>
                            <span className="tabular-nums text-gray-700 dark:text-gray-300">Declarado: {formatCurrency(declaredTransfQr)}</span>
                            {match(salesTransfQr, declaredTransfQr) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Coincide
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 text-xs">Diferencia: {formatCurrency(declaredTransfQr - salesTransfQr)}</span>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
                <form onSubmit={handleCloseRegister} className="mt-6 space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">Conteo de efectivo por denominación</h3>
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Ingrese la cantidad de billetes/monedas por valor. El total se calcula automáticamente.</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {DENOMINATIONS.map((d) => (
                        <div key={d} className="flex items-center gap-1">
                          <label htmlFor={`denom-${d}`} className="w-14 shrink-0 text-right text-sm text-gray-600 dark:text-gray-400">
                            {d >= 1000 ? `$${d / 1000}k` : `$${d}`}
                          </label>
                          <FormattedNumberInput
                            id={`denom-${d}`}
                            aria-label={`Cantidad de ${d}`}
                            value={parseInt(closeForm.denominations[String(d)] ?? "0", 10) || 0}
                            onChange={(n) =>
                              setCloseForm((f) => ({
                                ...f,
                                denominations: { ...f.denominations, [String(d)]: String(Math.max(0, n)) },
                              }))
                            }
                            className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm tabular-nums text-gray-900 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                    {useDenominationsTotal ? (
                      <p className="mt-2 text-sm font-medium text-gray-800 dark:text-white">
                        Total efectivo (calculado): {formatCurrency(totalFromDenominations)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">O ingrese el total manualmente abajo si no usa denominaciones.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="close-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {useDenominationsTotal ? "Total efectivo (caja real) — calculado arriba" : "Total efectivo / conteo físico (caja real) *"}
                    </label>
                    {useDenominationsTotal ? (
                      <input
                        id="close-amount"
                        type="text"
                        readOnly
                        aria-label="Conteo físico caja real"
                        value={formatNumberInputDisplay(totalFromDenominations)}
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <FormattedNumberInput
                        id="close-amount"
                        required
                        aria-label="Conteo físico caja real"
                        value={parseNumberInputInput(closeForm.closingAmount) || 0}
                        onChange={(n) =>
                          setCloseForm((f) => ({ ...f, closingAmount: String(Math.max(0, n)) }))
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Diferencia = Caja real − Caja esperada (negativo = faltante, positivo = sobrante)</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">Totales declarados al cierre</h3>
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Cargue los totales de tarjetas y de transferencias + QR (del turno). Se pre-cargan desde el POS si aplica.</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label htmlFor="close-cards" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Total tarjetas</label>
                        <input
                          id="close-cards"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={formatCurrency(salesCards)}
                          value={closeForm.closingCardsTotal}
                          onChange={(e) => setCloseForm((f) => ({ ...f, closingCardsTotal: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="close-transfer-qr" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Total Transferencias + QR</label>
                        <input
                          id="close-transfer-qr"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={formatCurrency(salesTransfQr)}
                          value={closeForm.closingTransferQrTotal}
                          onChange={(e) => setCloseForm((f) => ({ ...f, closingTransferQrTotal: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="close-shift" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Turno</label>
                    <select
                      id="close-shift"
                      value={closeForm.shift}
                      onChange={(e) => setCloseForm((f) => ({ ...f, shift: e.target.value }))}
                      aria-label="Turno de cierre"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="morning">Mañana</option>
                      <option value="afternoon">Tarde</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="close-no-ticket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ventas sin ticket</label>
                    <input
                      id="close-no-ticket"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label="Ventas sin ticket"
                      value={closeForm.salesNoTicket}
                      onChange={(e) => setCloseForm((f) => ({ ...f, salesNoTicket: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="close-internal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Consumos internos</label>
                    <input
                      id="close-internal"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label="Consumos internos"
                      value={closeForm.internalConsumption}
                      onChange={(e) => setCloseForm((f) => ({ ...f, internalConsumption: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="close-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones</label>
                    <textarea
                      id="close-notes"
                      value={closeForm.notes}
                      onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      aria-label="Observaciones del cierre"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  {closeError && <p className="text-sm text-red-600 dark:text-red-400">{closeError}</p>}
                  <button
                    type="submit"
                    disabled={closeLoading || effectiveClosingAmount <= 0}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {closeLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Cerrar caja"}
                  </button>
                </form>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar movimiento</h2>
                <p className="mt-1 text-sm text-gray-500">Gastos, retiros o ingresos extra del turno</p>
                <form onSubmit={handleAddMovement} className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="movement-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                    <select
                      id="movement-type"
                      value={movementForm.type}
                      onChange={(e) => setMovementForm((f) => ({ ...f, type: e.target.value as any }))}
                      aria-label="Tipo de movimiento"
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="expense">Gasto en efectivo</option>
                      <option value="withdrawal">Retiro de caja</option>
                      <option value="extra_income">Ingreso extraordinario</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="movement-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Monto *</label>
                    <FormattedNumberInput
                      id="movement-amount"
                      required
                      aria-label="Monto del movimiento"
                      value={parseNumberInputInput(movementForm.amount) || 0}
                      onChange={(n) =>
                        setMovementForm((f) => ({ ...f, amount: String(Math.max(0, n)) }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="movement-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo</label>
                    <input
                      id="movement-reason"
                      type="text"
                      value={movementForm.reason}
                      onChange={(e) => setMovementForm((f) => ({ ...f, reason: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ej. Compra cambio, depósito banco"
                      aria-label="Motivo del movimiento"
                    />
                  </div>
                  {movementError && <p className="text-sm text-red-600 dark:text-red-400">{movementError}</p>}
                  <button
                    type="submit"
                    disabled={movementLoading}
                    className={cn(
                      "w-full rounded-lg py-2.5 text-sm font-medium transition-colors",
                      movementLoading
                        ? "cursor-not-allowed border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                  >
                    {movementLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Agregar"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-600">No hay caja abierta en este local.</p>
              <p className="text-sm text-gray-500">Abre la caja desde el POS o desde Caja para poder cerrar el turno aquí.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "reportes" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reportes por período</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="report-type" className="block text-xs font-medium text-gray-500">Tipo</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                aria-label="Tipo de reporte"
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-from" className="block text-xs font-medium text-gray-500">Desde</label>
              <input
                id="report-from"
                type="date"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
                aria-label="Fecha desde"
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="report-to" className="block text-xs font-medium text-gray-500">Hasta</label>
              <input
                id="report-to"
                type="date"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
                aria-label="Fecha hasta"
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleLoadReport}
              disabled={reportLoading || !selectedLocationId || !reportDateFrom || !reportDateTo}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar"}
            </button>
          </div>
          {reportData && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-white">Cierres</p>
                  <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{reportData.summary?.totalClosures ?? 0}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-white">Ventas totales</p>
                  <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(reportData.summary?.totalSales ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-white">Diferencia total</p>
                  <p className={cn("text-xl font-bold tabular-nums", (reportData.summary?.totalDifference ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(reportData.summary?.totalDifference ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Resultado diario (ingresos − gastos)</p>
                  <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(reportData.summary?.dailyResult ?? 0)}</p>
                </div>
              </div>
              {reportData.closures?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-white">Fecha</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-white">Ventas</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-white">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.closures.map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-4 py-2 text-gray-900 dark:text-white">{c.closedAt ? new Date(c.closedAt).toLocaleString("es-CL") : "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-white">{formatCurrency(c.totalSales ?? 0)}</td>
                          <td className={cn("px-4 py-2 text-right tabular-nums", (c.difference ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                            {formatCurrency(c.difference ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
