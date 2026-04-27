#!/bin/bash
# Hook PostToolUse: corre eslint sobre el archivo .ts/.tsx que acabas de editar.
# Salida silenciosa si pasa, errores en stderr si rompe.
#
# Filosofía: feedback inmediato local. NO reemplaza un `tsc --noEmit` completo
# pre-commit (que captura errores cross-file). Sólo cubre lint del archivo
# tocado — rápido (<1s) y suficiente para el 80% de errores comunes.

set -e

# Lee el JSON del evento desde stdin.
input=$(cat)

# Extrae file_path. Python es más portable que jq en Windows.
file_path=$(echo "$input" | python -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    print(data.get('tool_input', {}).get('file_path', ''))
except Exception:
    pass
" 2>/dev/null)

# Filtros: solo archivos .ts/.tsx en selecta-eventos-manager/src/.
case "$file_path" in
  *selecta-eventos-manager/src/*.ts|*selecta-eventos-manager/src/*.tsx) ;;
  *) exit 0 ;;
esac

# Convertir path de Windows backslash a forward slash si hace falta.
file_path=$(echo "$file_path" | sed 's|\\|/|g')

cd "C:/Users/tomas/OneDrive/Irrelevant/Selecta/selecta-eventos-manager" || exit 0

# Corre eslint solo sobre el archivo cambiado. Output a stderr si hay errores.
output=$(npx eslint --no-error-on-unmatched-pattern "$file_path" 2>&1)
status=$?

if [ $status -ne 0 ]; then
  echo "⚠️ Lint errors en $(basename "$file_path"):" >&2
  echo "$output" >&2
  # No bloqueamos (PostToolUse exit code != 0 sólo notifica a Claude).
  exit 1
fi

exit 0
