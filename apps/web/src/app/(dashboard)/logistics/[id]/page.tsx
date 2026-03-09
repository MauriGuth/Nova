"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { sileo } from "sileo"
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  CheckCircle2,
  Circle,
  Clock,
  Package,
  AlertTriangle,
  QrCode,
  Send,
  ClipboardCheck,
  Loader2,
  FileText,
  MapPin,
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { shipmentsApi } from "@/lib/api/shipments"
import { cn, formatDate, formatDateOnly, formatTime, formatNumber, triggerContentUpdateAnimation } from "@/lib/utils"
import { FormattedNumberInput } from "@/components/ui/formatted-number-input"
import type { ShipmentStatus } from "@/types"

// ---------- helpers ----------

const statusConfig: Record<
  ShipmentStatus,
  { label: string; dot?: string; bg: string; text: string; pulse?: boolean }
> = {
  draft: {
    label: "Borrador",
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-400",
  },
  prepared: {
    label: "Preparado",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
  },
  dispatched: {
    label: "Despachado",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    pulse: true,
  },
  in_transit: {
    label: "En Tránsito",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    pulse: true,
  },
  reception_control: {
    label: "Tiempo de control de recepción",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    pulse: true,
  },
  delivered: {
    label: "Entregado",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  received: {
    label: "Recibido",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  received_with_diff: {
    label: "Recibido con Diferencia",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  closed: {
    label: "Cerrado",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-600",
  },
  cancelled: {
    label: "Cancelado",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
}

const progressSteps = [
  { key: "draft", label: "Creado" },
  { key: "prepared", label: "Preparado" },
  { key: "dispatched", label: "Despachado" },
  { key: "in_transit", label: "En Tránsito" },
  { key: "reception_control", label: "Tiempo de control de recepción" },
  { key: "received", label: "Recibido" },
]

const statusOrder: Record<string, number> = {
  draft: 0,
  prepared: 1,
  dispatched: 2,
  in_transit: 3,
  reception_control: 4,
  delivered: 5,
  received: 5,
  received_with_diff: 5,
  closed: 5,
  cancelled: -1,
}

// ---------- skeleton ----------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
          <div className="flex gap-6 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="h-16 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 lg:col-span-2">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col items-center space-y-3 py-4">
            <div className="h-40 w-40 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- main page ----------

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const shipmentId = params.id as string

  const [shipment, setShipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [receivedByName, setReceivedByName] = useState("")
  const [receivedBySignature, setReceivedBySignature] = useState<string | null>(null)
  const [receptionNotes, setReceptionNotes] = useState("")
  const [hasSignature, setHasSignature] = useState(false)
  /** Cantidades enviadas por ítem (editable en draft/prepared) */
  const [sentQtys, setSentQtys] = useState<Record<string, number>>({})
  const [savingSentItemId, setSavingSentItemId] = useState<string | null>(null)
  /** Cantidades recibidas por ítem (solo en estado "Tiempo de control de recepción") */
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})
  /** Minutos transcurridos en control de recepción (contador en vivo cuando status === reception_control) */
  const [liveControlMinutes, setLiveControlMinutes] = useState<number | null>(null)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [qrBaseUrl, setQrBaseUrl] = useState("")
  const qrShipmentCanvasRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (typeof window !== "undefined") setQrBaseUrl(window.location.origin)
  }, [])

  const loadShipment = useCallback(async () => {
    if (!shipmentId) return
    setLoading(true)
    setError(null)
    try {
      const data = await shipmentsApi.getById(shipmentId)
      setShipment(data)
    } catch (err: any) {
      const msg = err?.message || "Error al cargar el envío"
      setError(msg)
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => {
    loadShipment()
  }, [loadShipment])

  // Inicializar cantidades enviadas editables en draft/prepared
  useEffect(() => {
    if (!shipment?.items?.length) return
    const st = (shipment.status || "").toLowerCase()
    if (st !== "draft" && st !== "prepared") return
    setSentQtys((prev) => {
      const next = { ...prev }
      for (const item of shipment.items) {
        const id = item.id || item.productId || item.product?.id
        if (id) next[id] = item.sentQty ?? item.quantity ?? 0
      }
      return next
    })
  }, [shipment?.id, shipment?.status, shipment?.items])

  // Inicializar cantidades recibidas editables solo en estado "Tiempo de control de recepción"
  useEffect(() => {
    if (!shipment?.items?.length) return
    const st = (shipment.status || "").toLowerCase()
    if (st !== "reception_control") return
    setReceivedQtys((prev) => {
      const next = { ...prev }
      for (const item of shipment.items) {
        const id = item.id || item.productId || item.product?.id
        if (id) next[id] = item.receivedQty ?? item.sentQty ?? item.quantity ?? 0
      }
      return next
    })
  }, [shipment?.id, shipment?.status, shipment?.items])

  // Contador en vivo del tiempo de control cuando el envío está en reception_control
  useEffect(() => {
    const st = (shipment?.status || "").toLowerCase()
    const startedAt = shipment?.receptionControlStartedAt
    if (st !== "reception_control" || !startedAt) {
      setLiveControlMinutes(null)
      return
    }
    const compute = () =>
      Math.round(
        (Date.now() - new Date(startedAt).getTime()) / 60000
      )
    setLiveControlMinutes(compute())
    const interval = setInterval(() => setLiveControlMinutes(compute()), 10000)
    return () => clearInterval(interval)
  }, [shipment?.status, shipment?.receptionControlStartedAt])

  const handleMarkPrepared = async () => {
    if (!shipmentId || actionLoading) return
    setActionLoading(true)
    setActionError(null)
    try {
      await shipmentsApi.prepare(shipmentId)
      await loadShipment()
      triggerContentUpdateAnimation()
      sileo.success({ title: "Envío marcado como preparado" })
    } catch (err: any) {
      const msg = err?.message || "Error al marcar como preparado"
      setActionError(msg)
      sileo.error({ title: msg })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!shipmentId || actionLoading) return
    if (typeof window !== "undefined" && !window.confirm("¿Cancelar este envío? Esta acción no se puede deshacer.")) return
    setActionLoading(true)
    setActionError(null)
    try {
      await shipmentsApi.cancel(shipmentId)
      sileo.success({ title: "Envío cancelado" })
      router.push("/logistics")
    } catch (err: any) {
      const msg = err?.message || "Error al cancelar el envío"
      setActionError(msg)
      sileo.error({ title: msg })
    } finally {
      setActionLoading(false)
    }
  }

  const handleLlegadaAlDestino = async () => {
    if (!shipmentId || actionLoading) return
    setActionLoading(true)
    setActionError(null)
    try {
      await shipmentsApi.startReceptionControl(shipmentId)
      const updated = await shipmentsApi.getById(shipmentId)
      setShipment(updated)
      triggerContentUpdateAnimation()
      const dispatchedAt = shipment?.dispatchedAt
      const startedAt = updated?.receptionControlStartedAt
      const minLlegada =
        dispatchedAt && startedAt
          ? Math.round(
              (new Date(startedAt).getTime() - new Date(dispatchedAt).getTime()) / 60000
            )
          : null
      if (minLlegada != null) {
        sileo.success({
          title: "Llegó al destino",
          description: `Tiempo del depósito al local: ${minLlegada} min. Complete los datos de recepción y confirme para registrar cuánto demoró en controlar el pedido.`,
        })
      } else {
        sileo.success({ title: "Llegó al destino. Complete los datos de recepción." })
      }
    } catch (err: any) {
      setActionError(err?.message ?? "Error")
      sileo.error({ title: err?.message ?? "Error" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDispatch = async () => {
    if (!shipmentId || actionLoading) return
    setActionLoading(true)
    setActionError(null)
    try {
      await shipmentsApi.dispatch(shipmentId)
      await loadShipment()
      triggerContentUpdateAnimation()
      sileo.success({ title: "Envío despachado. En tránsito." })
    } catch (err: any) {
      const msg = err?.message || "Error al despachar"
      setActionError(msg)
      sileo.error({ title: msg })
    } finally {
      setActionLoading(false)
    }
  }

  const getSignatureDataUrl = useCallback(() => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    const blank = document.createElement("canvas")
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL("image/png") === blank.toDataURL("image/png")) return null
    return canvas.toDataURL("image/png")
  }, [])

  const clearSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setReceivedBySignature(null)
      setHasSignature(false)
    }
  }, [])

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const initCanvasContext = useCallback(() => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.strokeStyle = "#111827"
      ctx.lineWidth = 2
      ctx.lineCap = "round"
    }
    return ctx
  }, [])

  const handleSignatureMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e)
    if (!p) return
    const ctx = initCanvasContext()
    if (!ctx) return
    lastPointRef.current = p
    isDrawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2)
    ctx.fillStyle = "#111827"
    ctx.fill()
    setReceivedBySignature("drawn")
  }

  const handleSignatureMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const p = getCanvasPoint(e)
    if (!p) return
    const ctx = initCanvasContext()
    if (!ctx || !lastPointRef.current) return
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastPointRef.current = p
  }

  const handleSignatureMouseUp = () => {
    if (isDrawingRef.current) setHasSignature(true)
    isDrawingRef.current = false
    lastPointRef.current = null
  }

  const handleConfirmReception = async () => {
    if (!shipmentId || actionLoading || !items.length) return
    if (!receivedByName.trim()) {
      setActionError("El nombre de quien recibe es obligatorio.")
      return
    }
    const signature = getSignatureDataUrl()
    if (!signature) {
      setActionError("La firma es obligatoria para registrar la entrega.")
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      await shipmentsApi.receive(shipmentId, {
        items: items.map((item) => ({
          itemId: item.id,
          receivedQty: receivedQtys[item.id] ?? item.sentQty,
        })),
        receivedByName: receivedByName.trim(),
        receivedBySignature: signature,
        receptionNotes: receptionNotes.trim() || undefined,
      })
      setReceivedByName("")
      setReceptionNotes("")
      clearSignature()
      await loadShipment()
      triggerContentUpdateAnimation()
      sileo.success({ title: "Recepción confirmada correctamente" })
    } catch (err: any) {
      const msg = err?.message || "Error al confirmar recepción"
      setActionError(msg)
      sileo.error({ title: msg })
    } finally {
      setActionLoading(false)
    }
  }

  const saveSentQty = useCallback(
    async (itemId: string, sentQty: number) => {
      if (!shipmentId || !shipment) return
      const item = (shipment.items || []).find(
        (i: any) => (i.id || i.productId || i.product?.id) === itemId
      )
      const current = item?.sentQty ?? item?.quantity ?? 0
      if (Math.abs(sentQty - current) < 1e-9) return
      setSavingSentItemId(itemId)
      try {
        await shipmentsApi.updateItem(shipmentId, itemId, { sentQty })
        setShipment((prev) => {
          if (!prev?.items) return prev
          return {
            ...prev,
            items: prev.items.map((i: any) =>
              (i.id || i.productId || i.product?.id) === itemId
                ? { ...i, sentQty }
                : i
            ),
          }
        })
        triggerContentUpdateAnimation()
      } catch (err: any) {
        sileo.error({ title: err?.message ?? "Error al guardar cantidad" })
      } finally {
        setSavingSentItemId(null)
      }
    },
    [shipmentId, shipment]
  )

  if (loading) {
    return <DetailSkeleton />
  }

  if (error || !shipment) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
          🚚
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {error ? "Error al cargar" : "Envío no encontrado"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {error || "El envío que buscas no existe."}
        </p>
        <Link
          href="/logistics"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Logística
        </Link>
      </div>
    )
  }

  const status = (shipment.status || "draft") as ShipmentStatus
  const cfg = statusConfig[status] || statusConfig.draft
  const currentStep = statusOrder[status] ?? -1

  // Adapt fields from API response
  const originName = shipment.origin?.name || "—"
  const destName = shipment.destination?.name || "—"
  const createdByName =
    shipment.createdBy?.firstName && shipment.createdBy?.lastName
      ? `${shipment.createdBy.firstName} ${shipment.createdBy.lastName}`
      : typeof shipment.createdBy === "string"
      ? shipment.createdBy
      : "—"

  // Items from API - adapt field names
  const items: {
    id: string
    productName: string
    sentQty: number
    receivedQty?: number
    difference?: number
    diffReason?: string
  }[] = (shipment.items || []).map((item: any) => ({
    id: item.id || item.productId || item.product?.id,
    productName: item.product?.name || item.productName || "—",
    sentQty: item.sentQty ?? item.quantity ?? 0,
    receivedQty: item.receivedQty,
    difference:
      item.difference ??
      (item.receivedQty != null ? item.sentQty - item.receivedQty : undefined),
    diffReason: item.diffReason || item.notes,
  }))

  return (
    <div className="space-y-6">
      {/* -------- Back link + Remito -------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/logistics"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-white transition-colors hover:text-gray-900 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Logística
        </Link>
        <Link
          href={`/logistics/${shipment.id}/remito`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          <FileText className="h-4 w-4" />
          Ver / Imprimir remito
        </Link>
      </div>

      {/* -------- Shipment Header -------- */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {shipment.shipmentNumber}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {originName}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-300" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {destName}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  cfg.bg,
                  cfg.text
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {cfg.pulse && (
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        cfg.dot
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-1.5 w-1.5 rounded-full",
                      cfg.dot
                    )}
                  />
                </span>
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Creado</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">
                {shipment.createdAt ? formatDate(shipment.createdAt) : "—"}
              </p>
            </div>
            {shipment.dispatchedAt && (
              <div>
                <p className="text-xs text-gray-400 dark:text-white">Despachado</p>
                <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">
                  {formatTime(shipment.dispatchedAt)}
                </p>
              </div>
            )}
            {shipment.receivedAt && (
              <div>
                <p className="text-xs text-gray-400 dark:text-white">Recibido</p>
                <p className="mt-0.5 font-semibold text-green-600 dark:text-green-400">
                  {formatTime(shipment.receivedAt)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Creado por</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">
                {createdByName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* -------- Progreso del Envío (línea de tiempo) -------- */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="mb-5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 dark:text-white" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Progreso del Envío
          </h3>
        </div>

        {status === "cancelled" ? (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Este envío fue cancelado
            </p>
          </div>
        ) : (
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200 dark:bg-gray-600" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 transition-all"
              style={{
                width: `${Math.max(0, (currentStep / (progressSteps.length - 1)) * 100)}%`,
              }}
            />
            {progressSteps.map((step, i) => {
              const isLastStep = i === progressSteps.length - 1
              const isReceived = status === "received" || status === "received_with_diff"
              const isCompleted =
                i < currentStep || (isLastStep && isReceived)
              const isCurrent =
                i === currentStep && !(isLastStep && isReceived)
              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                      isCompleted &&
                        "border-blue-500 bg-blue-500 text-white",
                      isCurrent &&
                        "border-blue-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 ring-4 ring-blue-100 dark:ring-blue-900/50",
                      !isCompleted && !isCurrent &&
                        "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isCurrent ? (
                      <Truck className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium",
                      isCurrent ? "text-blue-600 dark:text-blue-300" : isCompleted ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* -------- Tiempo de llegada (depósito → local): desde despacho hasta inicio de control -------- */}
      {shipment.dispatchedAt &&
        shipment.receptionControlStartedAt &&
        (status === "reception_control" || status === "received" || status === "received_with_diff") && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Tiempo de llegada (depósito → local)
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Despachado</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.dispatchedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Llegada al local (inicio control)</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.receptionControlStartedAt)}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-medium text-green-800 dark:text-green-200">
              {Math.round(
                (new Date(shipment.receptionControlStartedAt).getTime() -
                  new Date(shipment.dispatchedAt).getTime()) /
                  60000
              )}{" "}
              min
            </span>
          </div>
        </div>
      )}

      {/* -------- Tiempo de control en vivo (solo mientras está en reception_control) -------- */}
      {status === "reception_control" &&
        shipment.receptionControlStartedAt &&
        liveControlMinutes !== null && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
          <h3 className="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
            Tiempo de control de recepción
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Tiempo transcurrido:{" "}
            <span className="font-semibold">{liveControlMinutes} min</span>
          </p>
        </div>
      )}

      {/* -------- Demora en controlar el pedido (tras confirmar recepción) -------- */}
      {(status === "received" || status === "received_with_diff") &&
        shipment.receptionControlStartedAt &&
        shipment.receptionControlCompletedAt && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Tiempo de control de recepción
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Inicio control</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.receptionControlStartedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Recepción confirmada</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.receptionControlCompletedAt)}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              Demoró{" "}
              {Math.round(
                (new Date(shipment.receptionControlCompletedAt).getTime() -
                  new Date(shipment.receptionControlStartedAt).getTime()) /
                  60000
              )}{" "}
              min en controlar el pedido
            </span>
          </div>
        </div>
      )}

      {/* -------- Tiempo de entrega (cuando no se usó control de recepción) -------- */}
      {shipment.dispatchedAt &&
        (shipment.receivedAt || shipment.actualArrivalAt) &&
        !shipment.receptionControlStartedAt && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Tiempo de entrega
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Despachado</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.dispatchedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-white">Recibido</p>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {formatTime(shipment.actualArrivalAt ?? shipment.receivedAt)}
              </p>
            </div>
            {(() => {
              const receivedTime = (shipment.actualArrivalAt ?? shipment.receivedAt) as string
              const dispatched = new Date(shipment.dispatchedAt).getTime()
              const received = new Date(receivedTime).getTime()
              const durationMin = Math.round((received - dispatched) / 60000)
              return (
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-medium text-green-800 dark:text-green-200">
                  Tardó {durationMin} min desde el despacho
                </span>
              )
            })()}
          </div>
        </div>
      )}

      {/* -------- Ruta (polyline / enlace a Maps) -------- */}
      {(shipment.routePolyline || shipment.estimatedDurationMin != null || (shipment.origin?.address || shipment.destination?.address)) && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Ruta
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {shipment.routePolyline && (
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-medium text-green-800 dark:text-green-200">
                Ruta guardada (polyline)
              </span>
            )}
            {shipment.estimatedDurationMin != null && (
              <span className="text-sm text-gray-600 dark:text-white">
                Tiempo estimado: {shipment.estimatedDurationMin} min
              </span>
            )}
            {(shipment.origin?.address || shipment.destination?.address) && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(shipment.origin?.address || "")}&destination=${encodeURIComponent(shipment.destination?.address || "")}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <MapPin className="h-4 w-4" />
                Ver ruta en Google Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* -------- Grid: Items + QR -------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items Table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400 dark:text-white" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Detalle de Items
            </h3>
            <span className="ml-auto text-xs text-gray-400 dark:text-white">
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Cantidad Enviada
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Cantidad Recibida
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Diferencia
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isReceptionMode = status === "reception_control"
                  const canEditSent =
                    status === "draft" || status === "prepared"
                  const displaySentQty =
                    canEditSent ? (sentQtys[item.id] ?? item.sentQty) : item.sentQty
                  const receivedQty = isReceptionMode
                    ? (receivedQtys[item.id] ?? item.sentQty)
                    : item.receivedQty
                  const hasReceived = receivedQty !== undefined && receivedQty !== null
                  const diff = hasReceived ? displaySentQty - (receivedQty ?? 0) : undefined
                  const hasDiff = diff !== undefined && diff !== 0

                  return (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.productName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700 dark:text-white">
                        {canEditSent ? (
                          <span className="inline-flex items-center gap-1">
                            <FormattedNumberInput
                              value={sentQtys[item.id] ?? item.sentQty}
                              onChange={(n) =>
                                setSentQtys((prev) => ({
                                  ...prev,
                                  [item.id]: Math.max(0, n),
                                }))
                              }
                              onBlur={() => {
                                const q = sentQtys[item.id] ?? item.sentQty
                                const prev = item.sentQty ?? 0
                                if (q >= 0 && Math.abs(q - prev) > 1e-9) {
                                  saveSentQty(item.id, q)
                                }
                              }}
                              className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-right text-sm tabular-nums text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              aria-label={`Cantidad enviada ${item.productName}`}
                              disabled={savingSentItemId === item.id}
                            />
                            {savingSentItemId === item.id && (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
                            )}
                          </span>
                        ) : (
                          formatNumber(displaySentQty)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700 dark:text-white">
                        {isReceptionMode ? (
                          <FormattedNumberInput
                            value={receivedQtys[item.id] ?? item.sentQty}
                            onChange={(n) =>
                              setReceivedQtys((prev) => ({ ...prev, [item.id]: Math.max(0, n) }))
                            }
                            className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-right text-sm tabular-nums text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            aria-label={`Cantidad recibida ${item.productName}`}
                          />
                        ) : hasReceived ? (
                          formatNumber(item.receivedQty!)
                        ) : (
                          <span className="text-gray-300 dark:text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasReceived ? (
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              hasDiff ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                            )}
                          >
                            {hasDiff ? diff : "0"}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300 dark:text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasReceived ? (
                          hasDiff ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Diferencia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              OK
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-white">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white"
                    >
                      No hay items en este envío
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Diff reasons */}
          {items.some((item) => item.diffReason) && (
            <div className="mt-4 space-y-2">
              {items
                .filter((item) => item.diffReason)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 px-3 py-2"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500 dark:text-orange-400" />
                    <p className="text-xs text-orange-700 dark:text-orange-200">
                      <span className="font-medium">{item.productName}:</span>{" "}
                      {item.diffReason}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* QR del Envío: solo visible cuando ya se entregó */}
        {(status === "received" || status === "received_with_diff") && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="mb-4 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-gray-400 dark:text-white" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                QR del Envío
              </h3>
            </div>

            <div className="flex flex-col items-center py-4" ref={qrShipmentCanvasRef}>
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                <QRCodeCanvas
                  value={
                    qrBaseUrl
                      ? `${qrBaseUrl}/shipment/${shipment.id}`
                      : shipment.id
                  }
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="mt-3 text-xs font-medium text-gray-600 dark:text-white">
                {shipment.shipmentNumber}
              </p>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-300">
                Escanear para ver detalle del envío
              </p>
              <button
                type="button"
                onClick={() => {
                  const canvas = qrShipmentCanvasRef.current?.querySelector?.("canvas")
                  if (canvas) {
                    const url = canvas.toDataURL("image/png")
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `qr-envio-${shipment.shipmentNumber}.png`
                    a.click()
                  }
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <QrCode className="h-3.5 w-3.5" />
                Descargar QR
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------- Datos de recepción: solo en estado "Tiempo de control de recepción" -------- */}
      {status === "reception_control" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Datos de recepción
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="received-by-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-white">
                Nombre de quien recibe <span className="text-red-500">*</span>
              </label>
              <p className="mb-2 text-[10px] text-gray-500 dark:text-gray-400">
                Obligatorio para registrar la entrega
              </p>
              <input
                id="received-by-name"
                type="text"
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Nombre de quien recibe"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-white">
                Firma <span className="text-red-500">*</span>
              </label>
              <p className="mb-2 text-[10px] text-gray-500 dark:text-gray-400">
                Obligatoria para registrar la entrega
              </p>
              <div className="flex flex-col gap-2">
                <canvas
                  ref={signatureCanvasRef}
                  width={300}
                  height={120}
                  className="cursor-crosshair touch-none rounded-lg border border-gray-300 bg-white"
                  onMouseDown={handleSignatureMouseDown}
                  onMouseMove={handleSignatureMouseMove}
                  onMouseUp={handleSignatureMouseUp}
                  onMouseLeave={handleSignatureMouseUp}
                  aria-label="Área de firma"
                />
                <button
                  type="button"
                  onClick={clearSignature}
                  className="w-fit rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Limpiar firma
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="reception-notes" className="mb-1 block text-xs font-medium text-gray-600 dark:text-white">
                ¿Faltó algo o llegó algo roto/dañado? (opcional)
              </label>
              <textarea
                id="reception-notes"
                value={receptionNotes}
                onChange={(e) => setReceptionNotes(e.target.value)}
                placeholder="Ej: Faltaban 2 unidades de agua, una caja llegó golpeada..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Observaciones de recepción"
              />
            </div>
          </div>
        </div>
      )}

      {/* -------- Recibido por (cuando ya está recibido) -------- */}
      {(status === "received" || status === "received_with_diff") &&
        (shipment.receivedByName || shipment.receivedBySignature || shipment.receptionNotes) && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Recepción registrada
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              {shipment.receivedByName && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-white">Recibido por</p>
                  <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                    {shipment.receivedByName}
                  </p>
                </div>
              )}
              {shipment.receivedBySignature && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-medium text-green-800 dark:text-green-200">
                    Firma registrada
                  </span>
                </div>
              )}
              {shipment.receptionNotes && (
                <div className="w-full">
                  <p className="text-xs text-gray-400 dark:text-white">Observaciones (faltantes / daños)</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {shipment.receptionNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* -------- Action error -------- */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* -------- Actions -------- */}
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" && (
          <button
            type="button"
            onClick={handleMarkPrepared}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-yellow-600 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            Marcar como Preparado
          </button>
        )}
        {status === "prepared" && (
          <button
            type="button"
            onClick={handleDispatch}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Despachar Envío
          </button>
        )}
        {(status === "dispatched" || status === "in_transit") && (
          <button
            type="button"
            onClick={handleLlegadaAlDestino}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Llegó al destino
          </button>
        )}
        {status === "reception_control" && (
          <button
            type="button"
            onClick={handleConfirmReception}
            disabled={actionLoading || !hasSignature || !receivedByName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar Recepción
          </button>
        )}
        {status === "delivered" && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Cerrar Envío
          </button>
        )}
        {(status === "draft" || status === "prepared") && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar Envío
          </button>
        )}
      </div>
    </div>
  )
}
