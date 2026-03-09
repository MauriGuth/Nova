"use client"

import Link from "next/link"
import { Banknote, UtensilsCrossed, ChefHat, Coffee, Warehouse } from "lucide-react"

export default function PosStationSelectorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-amber-100 bg-white px-8 py-10 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
              <span className="text-3xl font-black text-white">E</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Elige tu estación</h1>
            <p className="mt-2 text-sm text-gray-500">Inicia sesión en el link de tu rol</p>
          </div>
          <div className="space-y-3">
            <Link
              href="/cajero"
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Banknote className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">Cajero</p>
                <p className="text-sm text-gray-500">Mesas y Caja</p>
              </div>
            </Link>
            <Link
              href="/mozo"
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <UtensilsCrossed className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">Mozo</p>
                <p className="text-sm text-gray-500">Mesas</p>
              </div>
            </Link>
            <Link
              href="/kitchen"
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <ChefHat className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">Cocina</p>
                <p className="text-sm text-gray-500">Pantalla de cocina</p>
              </div>
            </Link>
            <Link
              href="/cafeteria"
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Coffee className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">Cafetería</p>
                <p className="text-sm text-gray-500">Pantalla de cafetería</p>
              </div>
            </Link>
            <Link
              href="/deposito"
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Warehouse className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">Depósito</p>
                <p className="text-sm text-gray-500">Mesas y comandas</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
