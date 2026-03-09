"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { sileo } from "sileo"
import {
  AlertTriangle,
  Bell,
  Brain,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Loader2,
  Zap,
  TrendingUp,
  ShieldAlert,
  Package,
  Wifi,
  Sparkles,
  Target,
  Lightbulb,
  Info,
  ArrowRight,
  CreditCard,
} from "lucide-react"
import Link from "next/link"
import { authApi } from "@/lib/api/auth"
import { alertsApi } from "@/lib/api/alerts"
import { aiEventsApi } from "@/lib/api/ai-events"
import { locationsApi } from "@/lib/api/locations"
import { incidentsApi } from "@/lib/api/incidents"
import { wasteRecordsApi } from "@/lib/api/waste-records"
import { cn, formatDateTime } from "@/lib/utils"

// ---------- helpers ----------

/** Filtra alertas por rol: tipos que el rol no debe ver (ej. logística no ve payment_order). */
function filterAlertsByRole<T extends { type?: string }>(items: T[], role: string | undefined): T[] {
  const r = role?.toUpperCase()
  if (r === "LOGISTICS") return items.filter((a) => a.type !== "payment_order")
  return items
}


const priorityConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string; darkBg: string; darkText: string }
> = {
  critical: {
    label: "Crítico",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
    darkBg: "dark:bg-red-900/50",
    darkText: "dark:text-red-300",
  },
  high: {
    label: "Alto",
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
    darkBg: "dark:bg-orange-900/50",
    darkText: "dark:text-orange-300",
  },
  medium: {
    label: "Medio",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
    darkBg: "dark:bg-yellow-900/50",
    darkText: "dark:text-yellow-200",
  },
  low: {
    label: "Bajo",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
    darkBg: "dark:bg-blue-900/50",
    darkText: "dark:text-blue-300",
  },
}

const statusConfig: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
  active: { label: "Activa", bg: "bg-red-50", text: "text-red-700", darkBg: "dark:bg-red-900/50", darkText: "dark:text-red-300" },
  read: { label: "Leída", bg: "bg-blue-50", text: "text-blue-700", darkBg: "dark:bg-blue-900/50", darkText: "dark:text-blue-300" },
  resolved: { label: "Resuelta", bg: "bg-green-50", text: "text-green-700", darkBg: "dark:bg-green-900/50", darkText: "dark:text-green-300" },
  dismissed: { label: "Descartada", bg: "bg-gray-100", text: "text-gray-600", darkBg: "dark:bg-gray-700", darkText: "dark:text-gray-300" },
}

const alertTypeIcons: Record<string, React.ReactNode> = {
  stock_critical: <Package className="h-4 w-4" />,
  location_offline: <Wifi className="h-4 w-4" />,
  correction_pending: <ShieldAlert className="h-4 w-4" />,
  stock_low: <AlertTriangle className="h-4 w-4" />,
  payment_order: <CreditCard className="h-4 w-4" />,
  waste_high: <ShieldAlert className="h-4 w-4" />,
  shipment_delay: <AlertTriangle className="h-4 w-4" />,
}

const severityConfig: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ReactNode; darkBg: string; darkText: string }
> = {
  critical: {
    label: "Crítico",
    bg: "bg-red-100",
    text: "text-red-700",
    icon: <AlertTriangle className="h-4 w-4" />,
    darkBg: "dark:bg-red-900/50",
    darkText: "dark:text-red-300",
  },
  warning: {
    label: "Advertencia",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    icon: <Zap className="h-4 w-4" />,
    darkBg: "dark:bg-yellow-900/50",
    darkText: "dark:text-yellow-200",
  },
  info: {
    label: "Info",
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: <TrendingUp className="h-4 w-4" />,
    darkBg: "dark:bg-blue-900/50",
    darkText: "dark:text-blue-300",
  },
  suggestion: {
    label: "Sugerencia",
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: <Brain className="h-4 w-4" />,
    darkBg: "dark:bg-purple-900/50",
    darkText: "dark:text-purple-300",
  },
}

const aiEventTypeIcons: Record<string, React.ReactNode> = {
  purchase_suggestion: <Package className="h-5 w-5 text-blue-600" />,
  anomaly_detection: <ShieldAlert className="h-5 w-5 text-red-600" />,
  stock_prediction: <TrendingUp className="h-5 w-5 text-green-600" />,
  production_suggestion: <Brain className="h-5 w-5 text-purple-600" />,
}

// ---------- main page ----------

export default function AlertsPage() {
  const searchParams = useSearchParams()
  const highlightAlertId = searchParams.get("id")
  const [user, setUser] = useState<{ role?: string } | null>(null)
  useEffect(() => {
    setUser(authApi.getStoredUser())
  }, [])
  const isLogisticsRole =
    user?.role === "LOGISTICS" || user?.role === "logistics"

  const [activeTab, setActiveTab] = useState<"alerts" | "ai">("alerts")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [alerts, setAlerts] = useState<any[]>([])
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [activeAlertCount, setActiveAlertCount] = useState(0)
  const [aiEvents, setAiEvents] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false)
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null)

  // Filters
  const [filterPriority, setFilterPriority] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterLocation, setFilterLocation] = useState("")

  // Per-button action loading: Set of keys like "alertId_read", "alertId_resolve"
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())
  // Per-item error messages with auto-clear
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  // Reporte de incidentes (Fase 6)
  const [incidentsReportLoading, setIncidentsReportLoading] = useState(false)
  const [incidentsReportResult, setIncidentsReportResult] = useState<{
    findings: Array<{ type: string; message: string; priority: string }>
    alertsCreated: number
  } | null>(null)
  const [incidentsReportError, setIncidentsReportError] = useState<string | null>(null)
  const [wasteAnalysisLoading, setWasteAnalysisLoading] = useState(false)
  const [wasteAnalysisError, setWasteAnalysisError] = useState<string | null>(null)
  const [wasteAnalysisResult, setWasteAnalysisResult] = useState<{
    summary: { totalQuantity: number; recordCount: number; byLocation: any[]; byProduct: any[]; byType: any[] }
    aiEvent: any
  } | null>(null)
  const errorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // --- action-loading helpers ---

  const startAction = (key: string) => {
    setActionLoading((prev) => new Set(prev).add(key))
    // Clear any existing error for this item
    const itemId = key.split("_")[0]
    clearActionError(itemId)
  }

  const stopAction = (key: string) => {
    setActionLoading((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const setActionError = (id: string, message: string) => {
    setActionErrors((prev) => ({ ...prev, [id]: message }))
    if (errorTimers.current[id]) clearTimeout(errorTimers.current[id])
    errorTimers.current[id] = setTimeout(() => {
      clearActionError(id)
    }, 5000)
  }

  const clearActionError = (id: string) => {
    setActionErrors((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (errorTimers.current[id]) {
      clearTimeout(errorTimers.current[id])
      delete errorTimers.current[id]
    }
  }

  // --- data fetching ---

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [alertsRes, alertCountRes, aiEventsRes, locationsRes] =
        await Promise.all([
          alertsApi.getAll({
            priority: filterPriority || undefined,
            type: filterType || undefined,
            status: filterStatus || undefined,
            locationId: filterLocation || undefined,
            limit: 50,
          }),
          alertsApi.getCount(),
          aiEventsApi.getActive(),
          locationsApi.getAll(),
        ])

      // Alerts: backend returns { data: Alert[], total }; filtrar por rol (ej. logística no ve órdenes de pago)
      const rawAlerts = Array.isArray(alertsRes)
        ? alertsRes
        : alertsRes?.data ?? []
      const user = authApi.getStoredUser()
      const alertsData = filterAlertsByRole(rawAlerts, user?.role)
      setAlerts(alertsData)
      setAlertsTotal(alertsData.length)

      // Active alert count (solo las que el rol puede ver)
      setActiveAlertCount(alertsData.filter((a: any) => a.status === "active").length)

      // AI events: /active endpoint returns array directly
      setAiEvents(Array.isArray(aiEventsRes) ? aiEventsRes : [])

      // Locations: may return array or { data: [] }
      const locsData = Array.isArray(locationsRes)
        ? locationsRes
        : (locationsRes as any)?.data ?? []
      setLocations(locsData)
    } catch (err: any) {
      const msg = err.message || "Error al cargar datos"
      setError(msg)
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }, [filterPriority, filterType, filterStatus, filterLocation])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Scroll to highlighted alert when opened from topbar (e.g. ?id=xxx)
  useEffect(() => {
    if (!highlightAlertId || loading || alerts.length === 0) return
    const el = document.querySelector(`[data-alert-id="${highlightAlertId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightAlertId, loading, alerts.length])

  // Cleanup error timers on unmount
  useEffect(() => {
    const timers = errorTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  // ---- AI Analysis ----

  const runAiAlertAnalysis = useCallback(async () => {
    setAiAnalysisLoading(true)
    setAiAnalysisError(null)
    try {
      const result = await aiEventsApi.analyzeAlerts()
      setAiAnalysis(result.analysis)
    } catch (err: any) {
      const msg = err.message || "Error al generar análisis con IA"
      setAiAnalysisError(msg)
      sileo.error({ title: msg })
    } finally {
      setAiAnalysisLoading(false)
    }
  }, [])

  // ---- Alert actions ----

  const handleMarkAsRead = async (id: string) => {
    const key = `${id}_read`
    startAction(key)
    try {
      await alertsApi.markAsRead(id)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "read" } : a))
      )
      // Was active -> read, decrement active count
      setActiveAlertCount((prev) => Math.max(0, prev - 1))
      sileo.success({ title: "Alerta marcada como leída" })
    } catch (err: any) {
      const msg = err.message || "Error al marcar como leída"
      setActionError(id, msg)
      sileo.error({ title: msg })
    } finally {
      stopAction(key)
    }
  }

  const handleResolve = async (id: string) => {
    const key = `${id}_resolve`
    const alert = alerts.find((a) => a.id === id)
    startAction(key)
    try {
      await alertsApi.resolve(id)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "resolved" } : a))
      )
      // Decrement active count only if it was active (not if it was already "read")
      if (alert?.status === "active") {
        setActiveAlertCount((prev) => Math.max(0, prev - 1))
      }
      sileo.success({ title: "Alerta resuelta" })
    } catch (err: any) {
      const msg = err.message || "Error al resolver alerta"
      setActionError(id, msg)
      sileo.error({ title: msg })
    } finally {
      stopAction(key)
    }
  }

  const handleDismissAlert = async (id: string) => {
    const key = `${id}_dismiss`
    const alert = alerts.find((a) => a.id === id)
    startAction(key)
    try {
      await alertsApi.dismiss(id)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "dismissed" } : a))
      )
      // Decrement active count only if it was active
      if (alert?.status === "active") {
        setActiveAlertCount((prev) => Math.max(0, prev - 1))
      }
      sileo.success({ title: "Alerta descartada" })
    } catch (err: any) {
      const msg = err.message || "Error al descartar alerta"
      setActionError(id, msg)
      sileo.error({ title: msg })
    } finally {
      stopAction(key)
    }
  }

  // ---- AI Event actions ----

  const handleAiTakeAction = async (id: string) => {
    const key = `${id}_action`
    startAction(key)
    try {
      await aiEventsApi.takeAction(id, { actionTaken: "Accepted by user" })
      // Remove from active list on success
      setAiEvents((prev) => prev.filter((e) => e.id !== id))
      sileo.success({ title: "Acción registrada" })
    } catch (err: any) {
      const msg = err.message || "Error al tomar acción"
      setActionError(id, msg)
      sileo.error({ title: msg })
    } finally {
      stopAction(key)
    }
  }

  const handleAiDismiss = async (id: string) => {
    const key = `${id}_aidismiss`
    startAction(key)
    try {
      await aiEventsApi.dismiss(id)
      // Remove from active list on success
      setAiEvents((prev) => prev.filter((e) => e.id !== id))
      sileo.success({ title: "Evento descartado" })
    } catch (err: any) {
      const msg = err.message || "Error al descartar evento"
      setActionError(id, msg)
      sileo.error({ title: msg })
    } finally {
      stopAction(key)
    }
  }

  const handleRunIncidentsReport = async () => {
    setIncidentsReportLoading(true)
    setIncidentsReportError(null)
    setIncidentsReportResult(null)
    try {
      const res = await incidentsApi.runReport()
      setIncidentsReportResult(res)
      if (res.alertsCreated > 0) fetchData()
      sileo.success({ title: "Reporte de incidentes ejecutado" })
    } catch (err: any) {
      const msg = err?.message ?? "Error al ejecutar el reporte"
      setIncidentsReportError(msg)
      sileo.error({ title: msg })
    } finally {
      setIncidentsReportLoading(false)
    }
  }

  const handleRunWasteAnalysis = async () => {
    setWasteAnalysisLoading(true)
    setWasteAnalysisError(null)
    setWasteAnalysisResult(null)
    try {
      const res = await wasteRecordsApi.runWasteAnalysis()
      setWasteAnalysisResult(res)
      fetchData()
      sileo.success({ title: "Análisis de mermas ejecutado" })
    } catch (err: any) {
      const msg = err?.message ?? "Error al ejecutar el análisis"
      setWasteAnalysisError(msg)
      sileo.error({ title: msg })
    } finally {
      setWasteAnalysisLoading(false)
    }
  }

  // ---- render ----

  return (
    <div className="space-y-6">
      {/* -------- Header -------- */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Alertas &amp; Eventos IA
            </h1>
            {activeAlertCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                <Bell className="h-3 w-3" />
                {activeAlertCount} activa{activeAlertCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {isLogisticsRole
              ? "Monitoreo de alertas del sistema"
              : "Monitoreo de alertas del sistema y eventos de inteligencia artificial"}
          </p>
        </div>
      </div>

      {/* -------- Reporte de incidentes (solo si no es logística) -------- */}
      {!isLogisticsRole && (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Reporte de incidentes</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Detecta mermas elevadas (7 días) y envíos con retraso; crea alertas. Ejecutar manualmente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunIncidentsReport}
            disabled={incidentsReportLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {incidentsReportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Ejecutar reporte
          </button>
        </div>
        {incidentsReportError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{incidentsReportError}</p>
        )}
        {incidentsReportResult && (
          <div className="mt-4 space-y-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-sm font-medium text-gray-700 dark:text-white">
              Se crearon {incidentsReportResult.alertsCreated} alerta{incidentsReportResult.alertsCreated !== 1 ? "s" : ""}.
              {incidentsReportResult.findings.length > 0 ? ` ${incidentsReportResult.findings.length} hallazgo(s).` : ""}
            </p>
            {incidentsReportResult.findings.length > 0 && (
              <ul className="list-inside list-disc text-xs text-gray-600 dark:text-gray-300">
                {incidentsReportResult.findings.map((f, i) => (
                  <li key={i}>{f.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      )}

      {/* -------- Análisis de mermas (solo si no es logística) -------- */}
      {!isLogisticsRole && (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Análisis de mermas</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Patrones por producto, local y tipo (últimos 30 días). Crea un evento en IA con sugerencias.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunWasteAnalysis}
            disabled={wasteAnalysisLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {wasteAnalysisLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            Ejecutar análisis
          </button>
        </div>
        {wasteAnalysisError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{wasteAnalysisError}</p>
        )}
        {wasteAnalysisResult && (
          <div className="mt-4 space-y-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-sm font-medium text-gray-700 dark:text-white">
              Total: {Math.round(wasteAnalysisResult.summary.totalQuantity)} unidades en{" "}
              {wasteAnalysisResult.summary.recordCount} registros. Evento IA creado.
            </p>
            {wasteAnalysisResult.summary.byProduct.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Top producto: {wasteAnalysisResult.summary.byProduct[0].productName} (
                {Math.round(wasteAnalysisResult.summary.byProduct[0].totalQuantity)} u)
              </p>
            )}
            {wasteAnalysisResult.summary.byLocation.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Top local: {wasteAnalysisResult.summary.byLocation[0].locationName} (
                {Math.round(wasteAnalysisResult.summary.byLocation[0].totalQuantity)} u)
              </p>
            )}
          </div>
        )}
      </div>
      )}

      {/* -------- Tabs (logística solo ve Alertas, sin pestaña Eventos IA) -------- */}
      {!isLogisticsRole && (
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setActiveTab("alerts")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "alerts"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-900 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          Alertas
          {alertsTotal > 0 && (
            <span className="rounded-full bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 text-[10px] font-semibold text-gray-900 dark:text-white">
              {alertsTotal}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "ai"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-900 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Brain className="h-4 w-4" />
          Eventos IA
          {aiEvents.length > 0 && (
            <span className="rounded-full bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
              {aiEvents.length}
            </span>
          )}
        </button>
      </div>
      )}

      {/* -------- Filters (alerts tab) -------- */}
      {activeTab === "alerts" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-300">
            <Filter className="h-4 w-4" />
            Filtros:
          </div>
          <select
            aria-label="Filtrar por prioridad"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas las prioridades</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>
          <select
            aria-label="Filtrar por tipo"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="stock_critical">Stock Crítico</option>
            <option value="stock_low">Stock Bajo</option>
            <option value="location_offline">Local Sin Conexión</option>
            <option value="correction_pending">Corrección Pendiente</option>
          </select>
          <select
            aria-label="Filtrar por estado"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activa</option>
            <option value="read">Leída</option>
            <option value="resolved">Resuelta</option>
            <option value="dismissed">Descartada</option>
          </select>
          <select
            aria-label="Filtrar por ubicación"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas las ubicaciones</option>
            {locations.map((loc: any) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* -------- Error -------- */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
          <button
            onClick={fetchData}
            className="ml-2 font-medium underline hover:no-underline dark:text-red-300"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* -------- Loading -------- */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* -------- Alerts Tab -------- */}
      {!loading && activeTab === "alerts" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Prioridad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Detalle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Fecha
                  </th>
                  <th className="w-28 min-w-28 shrink-0 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const priority =
                    priorityConfig[alert.priority] ?? priorityConfig.low
                  const status =
                    statusConfig[alert.status] ?? statusConfig.active
                  const isRowBusy =
                    actionLoading.has(`${alert.id}_read`) ||
                    actionLoading.has(`${alert.id}_resolve`) ||
                    actionLoading.has(`${alert.id}_dismiss`)
                  const rowError = actionErrors[alert.id]

                  return (
                    <tr
                      key={alert.id}
                      data-alert-id={alert.id}
                      className={cn(
                        "border-b border-gray-100 dark:border-gray-700 transition-colors",
                        alert.status === "active" && "bg-red-50/30 dark:bg-red-900/20",
                        highlightAlertId === alert.id && "bg-amber-100/60 dark:bg-amber-900/30 ring-1 ring-amber-300 dark:ring-amber-600 ring-inset"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            priority.bg,
                            priority.text,
                            priority.darkBg,
                            priority.darkText
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              priority.dot
                            )}
                          />
                          {priority.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                          {alertTypeIcons[alert.type] ?? (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          <span className="capitalize">
                            {(alert.type ?? "").replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {alert.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {alert.message}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-white">
                        {alert.locationName ?? alert.location?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            status.bg,
                            status.text,
                            status.darkBg,
                            status.darkText
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {alert.createdAt
                          ? formatDateTime(alert.createdAt)
                          : "—"}
                      </td>
                      <td className="w-28 min-w-28 shrink-0 px-4 py-3">
                        <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                          {alert.type === "payment_order" && (
                            <Link
                              href="/payment-orders"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Ver órdenes de pago
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                          <div className="flex items-center justify-end gap-1">
                            {/* --- Active alerts: Mark as Read / Resolve / Dismiss --- */}
                            {alert.status === "active" && (
                              <>
                                <button
                                  onClick={() => handleMarkAsRead(alert.id)}
                                  disabled={isRowBusy}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                                  title="Marcar como leída"
                                >
                                  {actionLoading.has(`${alert.id}_read`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleResolve(alert.id)}
                                  disabled={isRowBusy}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 dark:hover:bg-green-900/40 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
                                  title="Resolver"
                                >
                                  {actionLoading.has(`${alert.id}_resolve`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDismissAlert(alert.id)}
                                  disabled={isRowBusy}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                  title="Descartar"
                                >
                                  {actionLoading.has(`${alert.id}_dismiss`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                            {/* --- Read alerts: Resolve / Dismiss --- */}
                            {alert.status === "read" && (
                              <>
                                <button
                                  onClick={() => handleResolve(alert.id)}
                                  disabled={isRowBusy}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 dark:hover:bg-green-900/40 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
                                  title="Resolver"
                                >
                                  {actionLoading.has(`${alert.id}_resolve`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDismissAlert(alert.id)}
                                  disabled={isRowBusy}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                  title="Descartar"
                                >
                                  {actionLoading.has(`${alert.id}_dismiss`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                          {/* Inline error toast */}
                          {rowError && (
                            <p
                              className="max-w-[180px] truncate text-[10px] text-red-500"
                              title={rowError}
                            >
                              {rowError}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {alerts.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      <Shield className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                      No se encontraron alertas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------- AI Events Tab -------- */}
      {!loading && !isLogisticsRole && activeTab === "ai" && (
        <div className="space-y-6">
          {/* AI Analysis Panel */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-gray-800 dark:to-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-900 dark:text-white">Diagnóstico Inteligente</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300">Análisis de alertas con OpenAI GPT-4o</p>
                </div>
              </div>
              <button
                type="button"
                onClick={runAiAlertAnalysis}
                disabled={aiAnalysisLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50"
              >
                {aiAnalysisLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                {aiAnalysisLoading ? "Analizando..." : aiAnalysis ? "Regenerar" : "Analizar"}
              </button>
            </div>

            {aiAnalysisError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                {aiAnalysisError}
              </div>
            )}

            {aiAnalysisLoading && (
              <div className="mt-4 flex items-center gap-3 text-sm text-indigo-600 dark:text-indigo-300">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                Procesando alertas, stock y movimientos con IA...
              </div>
            )}

            {aiAnalysis && !aiAnalysisLoading && (
              <div className="mt-5 space-y-5">
                {/* Diagnosis + Risk Level */}
                <div className="flex items-start gap-4 rounded-xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    aiAnalysis.nivelRiesgo === "critico" ? "bg-red-100 dark:bg-red-900/50" :
                    aiAnalysis.nivelRiesgo === "alto" ? "bg-orange-100 dark:bg-orange-900/50" :
                    aiAnalysis.nivelRiesgo === "medio" ? "bg-yellow-100 dark:bg-yellow-900/50" : "bg-green-100 dark:bg-green-900/50"
                  )}>
                    <Shield className={cn(
                      "h-5 w-5",
                      aiAnalysis.nivelRiesgo === "critico" ? "text-red-600 dark:text-red-400" :
                      aiAnalysis.nivelRiesgo === "alto" ? "text-orange-600 dark:text-orange-400" :
                      aiAnalysis.nivelRiesgo === "medio" ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                        aiAnalysis.nivelRiesgo === "critico" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
                        aiAnalysis.nivelRiesgo === "alto" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" :
                        aiAnalysis.nivelRiesgo === "medio" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-200" : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      )}>
                        Riesgo {aiAnalysis.nivelRiesgo}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{aiAnalysis.diagnostico}</p>
                  </div>
                </div>

                {/* Priority Alerts */}
                {aiAnalysis.alertasPrioritarias && aiAnalysis.alertasPrioritarias.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                      Alertas Prioritarias
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.alertasPrioritarias.map((pa: any, i: number) => (
                        <div key={i} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white">{pa.titulo}</h5>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{pa.razon}</p>
                          <div className="mt-2 flex items-start gap-2 rounded bg-white dark:bg-gray-800 px-3 py-2">
                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{pa.accionInmediata}</p>
                          </div>
                          {pa.impactoEstimado && (
                            <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
                              Si no se actúa: {pa.impactoEstimado}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Patterns */}
                {aiAnalysis.patrones && aiAnalysis.patrones.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                      Patrones Detectados
                    </h4>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {aiAnalysis.patrones.map((p: any, i: number) => (
                        <div key={i} className={cn(
                          "rounded-lg border p-3",
                          p.tipo === "danger" ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/20" :
                          p.tipo === "warning" ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/20" : "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/20"
                        )}>
                          <h5 className="text-xs font-semibold text-gray-900 dark:text-white">{p.titulo}</h5>
                          <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">{p.descripcion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Plan */}
                {aiAnalysis.planAccion && aiAnalysis.planAccion.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                      <Zap className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                      Plan de Acción
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.planAccion.map((step: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            {step.paso || i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{step.accion}</p>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                              {step.responsable && <span>Responsable: {step.responsable}</span>}
                              {step.plazo && (
                                <>
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="font-medium text-indigo-600 dark:text-indigo-400">{step.plazo}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Predictions */}
                {aiAnalysis.prediccionesRiesgo && aiAnalysis.prediccionesRiesgo.length > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                      Predicciones de Riesgo
                    </h4>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {aiAnalysis.prediccionesRiesgo.map((pred: any, i: number) => (
                        <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-semibold text-gray-900 dark:text-white">{pred.riesgo}</h5>
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              pred.probabilidad === "alta" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
                              pred.probabilidad === "media" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            )}>
                              {pred.probabilidad}
                            </span>
                          </div>
                          {pred.plazo && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Plazo: {pred.plazo}</p>}
                          {pred.prevencion && (
                            <div className="mt-2 flex items-start gap-1.5 rounded bg-blue-50 dark:bg-blue-900/30 px-2 py-1.5">
                              <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400" />
                              <p className="text-[11px] text-blue-700 dark:text-blue-300">{pred.prevencion}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Events list */}
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Eventos IA Activos</h3>
          {aiEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16">
              <Brain className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-500" />
              <p className="text-sm text-gray-500 dark:text-gray-300">
                No hay eventos IA activos
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {aiEvents.map((event) => {
                const severity =
                  severityConfig[event.severity] ?? severityConfig.info
                const isActionBusy = actionLoading.has(`${event.id}_action`)
                const isDismissBusy = actionLoading.has(`${event.id}_aidismiss`)
                const isBusy = isActionBusy || isDismissBusy
                const eventError = actionErrors[event.id]

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-xl border bg-white dark:bg-gray-800 p-5 transition-shadow hover:shadow-md",
                      event.severity === "critical"
                        ? "border-red-200 dark:border-red-800"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          event.severity === "critical"
                            ? "bg-red-100 dark:bg-red-900/50"
                            : event.severity === "warning"
                              ? "bg-yellow-100 dark:bg-yellow-900/50"
                              : "bg-blue-100 dark:bg-blue-900/50"
                        )}
                      >
                        {aiEventTypeIcons[event.type] ?? (
                          <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {event.title}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              severity.bg,
                              severity.text,
                              severity.darkBg,
                              severity.darkText
                            )}
                          >
                            {severity.icon}
                            {severity.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {event.description}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleAiTakeAction(event.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 dark:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                          >
                            {isActionBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Tomar Acción
                          </button>
                          <button
                            onClick={() => handleAiDismiss(event.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                          >
                            {isDismissBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            Descartar
                          </button>
                          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                            {event.createdAt
                              ? formatDateTime(event.createdAt)
                              : ""}
                          </span>
                        </div>
                        {/* Inline error toast */}
                        {eventError && (
                          <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                            {eventError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
