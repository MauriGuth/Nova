"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { AuthGuard } from "@/components/auth/auth-guard"
import { ThemeSync } from "@/components/theme-sync"
import { NotificationsRunner } from "@/components/notifications-runner"
import { SessionTimeout } from "@/components/auth/session-timeout"

const DASHBOARD_ROLES = ["ADMIN", "LOCATION_MANAGER", "AUDITOR", "LOGISTICS"]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard allowedRoles={DASHBOARD_ROLES}>
      <ThemeSync />
      <NotificationsRunner />
      <SessionTimeout />
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  )
}
