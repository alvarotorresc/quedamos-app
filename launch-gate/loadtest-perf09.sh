#!/usr/bin/env bash
# PERF-09 — Prueba de carga de referencia (NO ejecutar contra producción sin autorización de Álvaro:
# no existe staging; el ThrottlerGuard global es 100 req/min por IP, así que contra producción la
# mayoría de respuestas serán 429 y la cifra p95 no sería representativa del backend).
#
# Opción A (recomendada): API local con la base de datos de desarrollo.
#   cd apps/api && pnpm dev            # en otra terminal, con .env de DESARROLLO (nunca el de producción)
#   API=http://localhost:3000 ./launch-gate/loadtest-perf09.sh
#
# Opción B: producción, SOLO con OK explícito y con el throttler subido temporalmente (o exceptuando /health).
#   API=https://quedamos.api.alvarotc.com ./launch-gate/loadtest-perf09.sh
#
# Objetivo del checklist: 3× el tráfico esperado durante 5 min, p95 < 500 ms, 0 errores (no-2xx).
# Tráfico esperado en beta: ~5-10 usuarios simultáneos → 20 conexiones ya es >3×.
set -euo pipefail
API="${API:-http://localhost:3000}"
OUT="$(dirname "$0")/loadtest-$(date +%Y%m%d-%H%M).txt"
echo "== autocannon contra $API (informe en $OUT)"
# 1) Ruta pública (mide framework + proxy + Firebase init flag, sin DB): 20 conexiones, 60 s (calentamiento)
npx --yes autocannon -c 20 -d 60 --renderStatusCodes "$API/health" | tee "$OUT"
# 2) Misma ruta, 5 minutos (criterio del checklist)
npx --yes autocannon -c 20 -d 300 --renderStatusCodes "$API/health" | tee -a "$OUT"
# 3) Ruta autenticada con DB (listado principal). Exporta antes: TOKEN=<JWT de un usuario de PRUEBA> GROUP=<uuid>
if [[ -n "${TOKEN:-}" && -n "${GROUP:-}" ]]; then
  npx --yes autocannon -c 20 -d 300 --renderStatusCodes -H "Authorization: Bearer $TOKEN" "$API/groups/$GROUP/availability" | tee -a "$OUT"
  npx --yes autocannon -c 20 -d 300 --renderStatusCodes -H "Authorization: Bearer $TOKEN" "$API/groups/$GROUP/events" | tee -a "$OUT"
fi
echo "== Leer: latency p97.5/p99 (autocannon no imprime p95: usar --latency o mirar 97.5 %), non-2xx = 0."
