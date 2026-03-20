"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"
import {
  Eye,
  EyeOff,
  Loader2,
  ChefHat,
  MapPin,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"
import { authApi } from "@/lib/api/auth"
import { locationsApi } from "@/lib/api/locations"
import { getLocationKey } from "@/lib/api"

type Step = "login" | "select-location"

const KITCHEN_ROLES = [
  "kitchen",
  "admin",
  "location_manager",
  "KITCHEN",
  "ADMIN",
  "LOCATION_MANAGER",
]
const LEGACY_KITCHEN_LOCATION_KEY = "elio_kitchen_location"

export default function KitchenLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("login")

  // Login form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Location selection
  const [locations, setLocations] = useState<any[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [needLocationPrompt, setNeedLocationPrompt] = useState(false)
  const [userTypedEmail, setUserTypedEmail] = useState(false)
  const [userTypedPassword, setUserTypedPassword] = useState(false)
  const isAdminUser = user?.role === "admin" || user?.role === "ADMIN"

  const readStoredLocation = () => {
    try {
      const scopedKey = getLocationKey()
      const scopedValue = localStorage.getItem(scopedKey)
      if (scopedValue) return JSON.parse(scopedValue)

      const legacyValue = localStorage.getItem(LEGACY_KITCHEN_LOCATION_KEY)
      if (!legacyValue) return null

      const parsed = JSON.parse(legacyValue)
      localStorage.setItem(scopedKey, legacyValue)
      return parsed
    } catch {
      return null
    }
  }

  // Ir directo a sucursal o pantalla (cocina no exige verificación por rostro)
  const goAfterLogin = (u: any) => {
    const isAdmin = u?.role === "admin" || u?.role === "ADMIN"
    const isLocMgr = u?.role === "LOCATION_MANAGER" || u?.role === "location_manager"
    if (isAdmin || isLocMgr) {
      setStep("select-location")
      fetchLocations()
      return
    }
    const loc = u?.location || readStoredLocation()
    if (loc) {
      if (!u?.location) {
        const serialized = JSON.stringify({ id: loc.id, name: loc.name, type: loc.type })
        localStorage.setItem(getLocationKey(), serialized)
        localStorage.setItem(LEGACY_KITCHEN_LOCATION_KEY, serialized)
      }
      router.push("/kitchen/display")
      return
    }
    setError("Tu cuenta no tiene una sucursal asignada")
  }

  // Check if already logged in
  useEffect(() => {
    const storedUser = authApi.getStoredUser()
    const isAuth = authApi.isAuthenticated()

    if (isAuth && storedUser && KITCHEN_ROLES.includes(storedUser.role)) {
      setUser(storedUser)
      goAfterLogin(storedUser)
    }
  }, [router])

  const fetchLocations = async () => {
    setLoadingLocations(true)
    try {
      const data = await locationsApi.getAll({ isActive: true })
      setLocations(data)
    } catch {
      setError("Error al cargar sucursales")
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim() || !password.trim()) {
      setError("Por favor, completa todos los campos")
      return
    }

    setLoading(true)
    setNeedLocationPrompt(false)
    try {
      const response = await authApi.login({ email, password })

      if (!KITCHEN_ROLES.includes(response.user.role)) {
        setError("No tienes permisos para acceder a la cocina")
        return
      }

      setUser(response.user)
      goAfterLogin(response.user)
      return
    } catch (err: unknown) {
      const code = (err as Error & { code?: string })?.code
      if (code === "LOCATION_REQUIRED") {
        setNeedLocationPrompt(true)
        setError((err as Error).message)
      } else {
        const message = err instanceof Error ? err.message : "Error al iniciar sesión"
        setError(message)
        sileo.error({ title: message })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoginWithLocation = async () => {
    setError("")
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    try {
      const response = await authApi.loginWithLocation({ email, password })
      if (!KITCHEN_ROLES.includes(response.user.role)) {
        setError("No tienes permisos para acceder a la cocina")
        return
      }
      setUser(response.user)
      setNeedLocationPrompt(false)
      goAfterLogin(response.user)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al obtener ubicación"
      setError(msg)
      sileo.error({ title: msg })
    } finally {
      setLoading(false)
    }
  }

  const selectLocation = (location: any) => {
    const serialized = JSON.stringify({
      id: location.id,
      name: location.name,
      type: location.type,
    })
    localStorage.setItem(getLocationKey(), serialized)
    localStorage.setItem(LEGACY_KITCHEN_LOCATION_KEY, serialized)
    router.push("/kitchen/display")
  }

  /* ── STEP 2: Location selector ── */
  if (step === "select-location") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/40 px-4 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-10 shadow-xl dark:border-gray-200 dark:bg-white">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500 shadow-lg">
                <ChefHat className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Cocina – Elegir sucursal</h1>
              <p className="mt-1 text-sm text-gray-600">Hola {user?.firstName}, elige la sucursal</p>
            </div>
            {loadingLocations ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => selectLocation(loc)}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left hover:border-blue-300 hover:bg-blue-50 dark:border-gray-300 dark:bg-gray-100"
                  >
                    <MapPin className="h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{loc.name}</p>
                      <p className="text-sm capitalize text-gray-600">{loc.type}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
                  </button>
                ))}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── STEP 1: Login form ── */
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/40 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-10 shadow-xl">
          <button
            type="button"
            onClick={() => router.push("/pos")}
            className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 shadow-lg">
              <ChefHat className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Cocina</h1>
            <p className="mt-2 text-sm text-gray-500">Solo Cocina, Admin o Gerente</p>
            <p className="mt-1 text-xs text-gray-400">Pantalla de cocina y despacho</p>
          </div>
          <form onSubmit={handleLogin} className="form-login-fields space-y-5">
            <div>
              <label htmlFor="kitchen-email" className="mb-2 block text-sm font-medium text-gray-700">
                Correo
              </label>
              <input
                id="kitchen-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  const v = e.target.value
                  setEmail(v)
                  setUserTypedEmail(v.length > 0)
                }}
                placeholder="cocina@roberto.com"
                className={`login-field w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${userTypedEmail ? "user-typed" : ""}`}
              />
            </div>
            <div>
              <label htmlFor="kitchen-password" className="mb-2 block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="kitchen-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    const v = e.target.value
                    setPassword(v)
                    setUserTypedPassword(v.length > 0)
                  }}
                  placeholder="••••••••"
                  className={`login-field w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-base transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${userTypedPassword ? "user-typed" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {needLocationPrompt && (
                  <button
                    type="button"
                    onClick={handleLoginWithLocation}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        Usar mi ubicación e iniciar sesión
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
