"use client"

import { ForceLightMode } from "@/components/force-light-mode"

export default function MozoLayout({
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
