"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Brain,
  ArrowRight,
  Truck,
  Package,
  Sparkles,
  Activity,
  MapPin,
  Loader2,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { authApi } from "@/lib/api/auth"
import { stockApi } from "@/lib/api/stock"
import { alertsApi } from "@/lib/api/alerts"
import { aiEventsApi } from "@/lib/api/ai-events"
import { locationsApi } from "@/lib/api/locations"
import { shipmentsApi } from "@/lib/api/shipments"
import { ordersApi } from "@/lib/api/orders"
import {
  cn,
  formatCurrency,
  formatNumber,
  getGreeting,
  formatTime,
} from "@/lib/utils"

// ---------- helpers ----------

const locationTypeLabels: Record<string, string> = {
  warehouse: "Depósito",
  cafe: "Café",
  restaurant: "Restaurante",
  express: "Express",
}

const statusDotColor: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  warning: "bg-yellow-500",
}

const statusLabel: Record<string, string> = {
  online: "Operativo",
  offline: "Sin conexión",
  warning: "Alerta",
}

const shipmentStatusStyle: Record<string, string> = {
  in_transit: "bg-blue-50 text-blue-700",
  delivered: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  dispatched: "bg-indigo-50 text-indigo-700",
  prepared: "bg-yellow-50 text-yellow-700",
}

const shipmentStatusLabel: Record<string, string> = {
  in_transit: "En tránsito",
  delivered: "Entregado",
  closed: "Cerrado",
  dispatched: "Despachado",
  prepared: "Preparado",
}

const severityIcon: Record<string, string> = {
  warning: "⚡",
  info: "📈",
  critical: "🔴",
}

// ---------- sub-components ----------

function CardHeader({
  icon,
  title,
  href,
  badge,
}: {
  icon?: React.ReactNode
  title: string
  href?: string
  badge?: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {badge && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-900">
            {badge}
          </span>
        )}
      </div>
      {href && (
        <a
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
        >
          Ver todo
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-gray-900 dark:text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs text-gray-600">
          {entry.dataKey === "current" ? "Esta semana" : "Semana anterior"}:{" "}
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(entry.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
    </div>
  )
}

// ---------- main page ----------

export default function DashboardPage() {
  const router = useRouter()
  const user = authApi.getStoredUser()
  const isLogistics =
    user?.role === "LOGISTICS" || user?.role === "logistics"

  // Logística no ve el dashboard: redirigir a Logística
  useEffect(() => {
    if (isLogistics) router.replace("/logistics")
  }, [isLogistics, router])

  // Data states
  const [stockSummary, setStockSummary] = useState<any>(null)
  const [alertCount, setAlertCount] = useState<number>(0)
  const [aiEvents, setAiEvents] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [shipments, setShipments] = useState<any[]>([])
  const [salesByWeek, setSalesByWeek] = useState<
    { day: string; current: number; previous: number }[]
  >([])

  // Loading states
  const [kpisLoading, setKpisLoading] = useState(true)
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [shipmentsLoading, setShipmentsLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(true)

  // Fetch KPIs (stock summary + alert count + ai events count)
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const [summaryRes, alertCountRes, aiEventsRes] = await Promise.all([
        stockApi.getSummary(),
        alertsApi.getCount().catch(() => ({ count: 0 })),
        aiEventsApi.getActive().catch(() => []),
      ])
      setStockSummary(summaryRes)
      setAlertCount(
        typeof alertCountRes === "number"
          ? alertCountRes
          : alertCountRes?.count ?? 0
      )
      setAiEvents(Array.isArray(aiEventsRes) ? aiEventsRes : [])
    } catch {
      /* silent */
    } finally {
      setKpisLoading(false)
      setAiLoading(false)
    }
  }, [])

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true)
    try {
      const res = await locationsApi.getAll()
      setLocations(Array.isArray(res) ? res : [])
    } catch {
      /* silent */
    } finally {
      setLocationsLoading(false)
    }
  }, [])

  // Fetch shipments
  const fetchShipments = useCallback(async () => {
    setShipmentsLoading(true)
    try {
      const res = await shipmentsApi.getAll({ limit: 5 })
      const data = Array.isArray(res) ? res : res?.data ?? []
      // Only show active shipments
      setShipments(
        data.filter(
          (s: any) =>
            s.status === "in_transit" ||
            s.status === "delivered" ||
            s.status === "dispatched" ||
            s.status === "prepared"
        )
      )
    } catch {
      /* silent */
    } finally {
      setShipmentsLoading(false)
    }
  }, [])

  // Ventas por semana (reales)
  const fetchSalesByWeek = useCallback(async () => {
    setSalesLoading(true)
    try {
      const res = await ordersApi.getSalesByWeek()
      const data = Array.isArray(res) ? res : []
      setSalesByWeek(
        data.length === 7
          ? data
          : [
              { day: "Lun", current: 0, previous: 0 },
              { day: "Mar", current: 0, previous: 0 },
              { day: "Mié", current: 0, previous: 0 },
              { day: "Jue", current: 0, previous: 0 },
              { day: "Vie", current: 0, previous: 0 },
              { day: "Sáb", current: 0, previous: 0 },
              { day: "Dom", current: 0, previous: 0 },
            ]
      )
    } catch {
      setSalesByWeek([
        { day: "Lun", current: 0, previous: 0 },
        { day: "Mar", current: 0, previous: 0 },
        { day: "Mié", current: 0, previous: 0 },
        { day: "Jue", current: 0, previous: 0 },
        { day: "Vie", current: 0, previous: 0 },
        { day: "Sáb", current: 0, previous: 0 },
        { day: "Dom", current: 0, previous: 0 },
      ])
    } finally {
      setSalesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKpis()
    fetchLocations()
    fetchShipments()
    fetchSalesByWeek()
  }, [fetchKpis, fetchLocations, fetchShipments, fetchSalesByWeek])

  const totalCurrentWeek = salesByWeek.reduce((s, d) => s + d.current, 0)
  const totalPreviousWeek = salesByWeek.reduce((s, d) => s + d.previous, 0)
  const weekDiff =
    totalPreviousWeek > 0
      ? ((totalCurrentWeek - totalPreviousWeek) / totalPreviousWeek) * 100
      : 0

  const today = new Date()
  const formattedDate = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today)

  // KPI cards from real data
  const kpis = [
    {
      label: "Stock Crítico",
      value: stockSummary?.criticalCount ?? stockSummary?.critical ?? 0,
      sub: "productos bajo mínimo",
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Alertas Activas",
      value: alertCount,
      sub: "alertas por resolver",
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Total Productos",
      value: stockSummary?.totalProducts ?? 0,
      sub: "productos en inventario",
      icon: ArrowUpDown,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Eventos IA",
      value: aiEvents.length,
      sub: "eventos activos",
      icon: Brain,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ]

  const activeLocations = locations.filter(
    (l: any) => l.isActive !== false
  ).length
  const [userName, setUserName] = useState("")
  useEffect(() => {
    const u = authApi.getStoredUser()
    if (u?.firstName) setUserName(u.firstName)
  }, [])

  if (isLogistics) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* -------- Greeting -------- */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          {getGreeting()}{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 capitalize sm:text-sm">
          {formattedDate}
        </p>
        <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-400">
          {activeLocations} locales activos · Depósito operativo
        </p>
      </div>

      {/* -------- KPI Cards -------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
              >
                <div className="h-12 w-12 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-16 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))
          : kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <div
                  key={kpi.label}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-shadow hover:shadow-md"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      kpi.bg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", kpi.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(kpi.value)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {kpi.sub}
                    </p>
                  </div>
                </div>
              )
            })}
      </div>

      {/* -------- Sales Chart + Locations (2:1) -------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales chart (datos reales) */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 lg:col-span-2">
          <CardHeader
            icon={<Activity className="h-4 w-4 text-gray-400" />}
            title="Ventas de la Semana"
            href="/reports"
          />

          <div className="h-64">
            {salesLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart
                data={salesByWeek}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F3F4F6"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickFormatter={(v: number) =>
                    `$${(v / 1_000_000).toFixed(1)}M`
                  }
                />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                />
                <Bar
                  dataKey="previous"
                  fill="#E5E7EB"
                  radius={[4, 4, 0, 0]}
                  name="Semana anterior"
                />
                <Bar
                  dataKey="current"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  name="Esta semana"
                />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs text-gray-500">Total esta semana</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalCurrentWeek)}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                weekDiff >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {weekDiff >= 0 ? "+" : ""}
              {weekDiff.toFixed(1)}% vs anterior
            </span>
          </div>
        </div>

        {/* Locations */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <CardHeader
            icon={<MapPin className="h-4 w-4 text-gray-400" />}
            title="Estado de Locales"
            href="/locations"
          />

          {locationsLoading ? (
            <SectionLoader />
          ) : (
            <div className="space-y-4">
              {locations.map((loc: any) => {
                const locStatus = loc.isActive !== false
                  ? loc.status ?? "online"
                  : "offline"
                const dotColor =
                  loc._criticalCount > 0 && locStatus === "online"
                    ? "bg-yellow-500"
                    : statusDotColor[locStatus] ?? "bg-gray-400"

                return (
                  <div
                    key={loc.id}
                    className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        dotColor
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {loc.name}
                        </p>
                        <span className="inline-flex shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-900">
                          {locationTypeLabels[loc.type] ?? loc.type}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          loc._criticalCount > 0
                            ? "text-yellow-600"
                            : "text-gray-400"
                        )}
                      >
                        {loc._criticalCount > 0
                          ? `${loc._criticalCount} items bajo stock`
                          : statusLabel[locStatus] ?? locStatus}
                      </p>
                    </div>
                  </div>
                )
              })}
              {locations.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">
                  Sin locales
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* -------- Shipments + AI Events (1:1) -------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Shipments */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <CardHeader
            icon={<Truck className="h-4 w-4 text-gray-400" />}
            title="Envíos en Curso"
            href="/logistics"
          />

          {shipmentsLoading ? (
            <SectionLoader />
          ) : (
            <div className="space-y-4">
              {shipments.map((shp: any) => (
                <div
                  key={shp.id}
                  className="rounded-lg border border-gray-100 dark:border-gray-700 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {shp.shipmentNumber}
                    </p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        shipmentStatusStyle[shp.status] ??
                          "bg-gray-100 text-gray-600"
                      )}
                    >
                      {shipmentStatusLabel[shp.status] ?? shp.status}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    {shp.origin?.name ?? "Origen"}{" "}
                    <span className="mx-1 text-gray-300">→</span>{" "}
                    {shp.destination?.name ?? "Destino"}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {shp.totalItems ?? shp.itemsCount ?? 0} items
                    </span>

                    {shp.status === "in_transit" &&
                      shp.estimatedArrival && (
                        <span>
                          Llegada est. {formatTime(shp.estimatedArrival)}
                        </span>
                      )}
                    {shp.status === "delivered" &&
                      shp.dispatchedAt && (
                        <span>
                          Entregado {formatTime(shp.dispatchedAt)}
                        </span>
                      )}
                  </div>
                </div>
              ))}

              {shipments.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">
                  No hay envíos activos
                </p>
              )}
            </div>
          )}
        </div>

        {/* AI Events */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <CardHeader
            icon={<Sparkles className="h-4 w-4 text-gray-400" />}
            title="Eventos IA"
            href="/alerts"
          />

          {aiLoading ? (
            <SectionLoader />
          ) : (
            <div className="space-y-3">
              {aiEvents.map((ev: any) => (
                <div
                  key={ev.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
                    ev.severity === "critical"
                      ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/30"
                      : "border-gray-100 dark:border-gray-700"
                  )}
                >
                  <span className="mt-0.5 text-base leading-none">
                    {severityIcon[ev.severity] ?? "📊"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {ev.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
              {aiEvents.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">
                  No hay eventos IA activos
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
