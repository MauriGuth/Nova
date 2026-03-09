"use client"

import { ForceLightMode } from "@/components/force-light-mode"

export default function CajeroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ForceLightMode />
      {children}
    </>
  )
}
