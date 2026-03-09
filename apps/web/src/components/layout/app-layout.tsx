'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'

const CONTENT_UPDATED_ANIMATION_MS = 400

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animación al actualizar/recargar contenido (después de guardar, editar, etc.)
  useEffect(() => {
    const handler = () => {
      const el = contentRef.current
      if (!el) return
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      el.classList.remove('animate-content-updated')
      el.offsetHeight // reflow para que la animación se repita
      el.classList.add('animate-content-updated')
      animationTimeoutRef.current = setTimeout(() => {
        el.classList.remove('animate-content-updated')
        animationTimeoutRef.current = null
      }, CONTENT_UPDATED_ANIMATION_MS)
    }
    window.addEventListener('content-updated', handler)
    return () => {
      window.removeEventListener('content-updated', handler)
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    }
  }, [])

  // Cerrar drawer al redimensionar a desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = () => {
      if (mq.matches) setSidebarOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-dvh max-h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 sm:h-screen print:block print:h-auto print:max-h-none print:overflow-visible">
      {/* Overlay móvil cuando el drawer está abierto */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/60 lg:hidden print:hidden"
        />
      )}

      {/* Sidebar: drawer en móvil/tablet, fijo en desktop — oculto al imprimir */}
      <div className="print:hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:w-full print:min-h-0 print:overflow-visible">
        <div className="print:hidden">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 print:overflow-visible print:p-0">
          <div ref={contentRef} key={pathname} className="animate-page-enter min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
