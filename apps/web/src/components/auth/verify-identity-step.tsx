"use client"

import { useState, useEffect, useRef } from "react"
import { authApi } from "@/lib/api/auth"
import { ArrowLeft, Camera, Loader2 } from "lucide-react"

type Props = {
  user: { firstName?: string; lastName?: string; avatarUrl?: string | null; role?: string }
  onVerified: () => void
  onReject: () => void
  /** Si la foto de referencia no existe en el servidor (ej. redeploy), el admin puede entrar al panel para actualizarla */
  onEnterPanelToFixPhoto?: () => void
}

const DASHBOARD_ROLES = ["ADMIN", "LOCATION_MANAGER", "AUDITOR", "LOGISTICS"]

export function VerifyIdentityStep({ user, onVerified, onReject, onEnterPanelToFixPhoto }: Props) {
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!videoRef.current) return
    setVerifyError(null)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setVerifyError("No se pudo acceder a la cámara"))
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleCaptureAndVerify = () => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream || video.readyState !== 4) return
    setVerifying(true)
    setVerifyError(null)
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setVerifying(false)
      return
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setVerifying(false)
          return
        }
        const file = new File([blob], "verification.jpg", { type: "image/jpeg" })
        try {
          const result = await authApi.verifyFace(file)
          if (result.verified) {
            stream.getTracks().forEach((t) => t.stop())
            streamRef.current = null
            onVerified()
          } else {
            setVerifyError("La foto no coincide con tu perfil. Intenta de nuevo.")
          }
        } catch (err) {
          setVerifyError(err instanceof Error ? err.message : "Error al verificar. Intenta de nuevo.")
        } finally {
          setVerifying(false)
        }
      },
      "image/jpeg",
      0.9
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-amber-100 bg-white px-8 py-10 shadow-xl">
          <button
            type="button"
            onClick={onReject}
            disabled={verifying}
            className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="mb-4 text-center">
            <h1 className="text-xl font-semibold text-gray-800">Verificación de identidad</h1>
            <p className="mt-1 text-sm text-gray-500">Toma una foto para que la comparemos con tu perfil</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="aspect-square w-full max-w-[280px] overflow-hidden rounded-xl bg-gray-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />
            </div>
            <p className="text-center text-sm font-medium text-gray-700">
              {user.firstName} {user.lastName}
            </p>
            {verifyError && (
              <>
                <p className="text-center text-sm text-red-600">{verifyError}</p>
                {onEnterPanelToFixPhoto &&
                  (verifyError.includes("foto de referencia") || verifyError.includes("referencia")) &&
                  DASHBOARD_ROLES.includes((user.role ?? "").toUpperCase()) && (
                    <button
                      type="button"
                      onClick={onEnterPanelToFixPhoto}
                      className="mt-2 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                      Soy admin: entrar al panel para actualizar mi foto
                    </button>
                  )}
              </>
            )}
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={onReject}
                className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={verifying}
              >
                No soy yo
              </button>
              <button
                type="button"
                onClick={handleCaptureAndVerify}
                disabled={verifying}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Tomar foto y verificar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
