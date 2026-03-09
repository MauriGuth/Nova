#!/bin/bash
# Libera el puerto 5432 y los archivos de lock para que Postgres.app pueda arrancar.
# Ejecutar: sudo bash scripts/fix-postgres-port.sh

set -e

echo "1. Deteniendo PostgreSQL 18 (instalación en /Library)..."
launchctl unload /Library/LaunchDaemons/postgresql-18.plist 2>/dev/null || true

echo "2. Eliminando archivos de lock en /tmp..."
rm -f /tmp/.s.PGSQL.5432 /tmp/.s.PGSQL.5432.lock

echo "3. Listo. Ahora podés iniciar Postgres.app desde la barra de menú."
echo "   Si Postgres.app ya está abierto, hacé click en 'Start' o reinicialo."
