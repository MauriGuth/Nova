"use client"

import { AlertCircle, ArrowLeft, LogOut } from "lucide-react"

export function NeedPhotoStep({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/40 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-10 shadow-xl">
          <button
            type="button"
            onClick={onLogout}
            className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <AlertCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-center text-xl font-semibold text-gray-800">
            Falta completar tu foto de perfil
          </h1>
          <p className="mt-3 text-center text-sm text-gray-600">
            Para poder acceder debes tener una foto de verificación registrada. Un administrador debe asignarte la foto en el panel de <strong>Usuarios</strong> (sección «Foto para verificación biométrica»).
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            Cuando tu perfil tenga la foto, podrás iniciar sesión y pasar el reconocimiento facial.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
