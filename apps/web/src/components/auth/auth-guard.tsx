"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"
import { ShieldX, LogOut } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administradores",
  LOCATION_MANAGER: "Gerentes de local",
  AUDITOR: "Auditores",
  LOGISTICS: "Logística",
}

interface AuthGuardProps {
  children: React.ReactNode
  /** Si se define, solo estos roles pueden ver el contenido. Si no, solo se exige estar autenticado. */
  allowedRoles?: string[]
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "authenticated" | "denied" | "unauthenticated">("checking")

  useEffect(() => {
    const isAuth = authApi.isAuthenticated()
    if (!isAuth) {
      setStatus("unauthenticated")
      router.replace("/login")
      return
    }
    if (allowedRoles && allowedRoles.length > 0) {
      const user = authApi.getStoredUser()
      const role = (user?.role ?? "").toUpperCase()
      if (!role || !allowedRoles.includes(role)) {
        setStatus("denied")
        return
      }
    }
    setStatus("authenticated")
  }, [router, allowedRoles])

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  if (status === "denied") {
    const allowedLabels = (allowedRoles ?? [])
      .map((r) => ROLE_LABELS[r] ?? r)
      .filter(Boolean)
    const whoCanAccess =
      allowedLabels.length > 0
        ? `Solo pueden acceder: ${allowedLabels.join(", ")}.`
        : "Tu usuario no tiene permiso para esta sección."

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <ShieldX className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">No podés acceder</h1>
          <p className="mt-2 text-sm text-slate-600">
            {whoCanAccess} Si creés que es un error, contactá al administrador.
          </p>
          <button
            type="button"
            onClick={() => {
              authApi.logout()
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
