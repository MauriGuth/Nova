"use client"

import { Toaster } from "sileo"

/**
 * Toaster de Sileo para notificaciones toast en toda la app.
 * Se monta en el layout raíz. Uso desde cualquier componente:
 *
 * import { sileo } from "sileo"
 * sileo.success("Guardado")
 * sileo.error("Algo falló")
 * sileo.info("Información")
 * sileo.warning("Atención")
 */
export function SileoToaster() {
  return <Toaster position="top-right" />
}
