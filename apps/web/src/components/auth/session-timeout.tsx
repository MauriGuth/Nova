"use client"

import { useEffect, useRef } from "react"
import { authApi } from "@/lib/api/auth"
import { getSecuritySettings } from "@/lib/settings"

const CHECK_INTERVAL_MS = 30 * 1000 // comprobar cada 30 s

/**
 * Cierra sesión automáticamente tras sessionTimeoutMinutes de inactividad.
 * Solo tiene efecto en el dashboard (donde se monta).
 */
export function SessionTimeout() {
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
    events.forEach((ev) => window.addEventListener(ev, updateActivity))
    return () => events.forEach((ev) => window.removeEventListener(ev, updateActivity))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!authApi.isAuthenticated()) return
      const security = getSecuritySettings()
      const timeoutMs = security.sessionTimeoutMinutes * 60 * 1000
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        authApi.logout()
      }
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
