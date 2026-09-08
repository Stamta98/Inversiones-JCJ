#!/usr/bin/env bash
#
# Trae de Supabase lo que ya está en producción: la base y las fotos.
#
# Se corre en el VPS, después de `instalar.sh`, y con la app detenida para que
# nadie cobre mientras se copia — un cobro registrado en Supabase durante la
# copia no llegaría al servidor nuevo y se perdería.
#
# Las dos claves que pide salen del panel de Supabase:
#   - La cadena de conexión: Project Settings > Database > Connection string
#     (la de "Session pooler" o la directa; las dos sirven para copiar).
#   - La llave de servicio: Project Settings > API > service_role
#
# Uso:
#   export SUPABASE_DB_URL="postgresql://postgres.xxxx:CLAVE@host:5432/postgres"
#   export SUPABASE_URL="https://xxxx.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
#   bash traer-datos.sh
#
set -Eeuo pipefail

BASE="${BASE:-inversiones_jcj}"
BUCKET="${BUCKET:-customer-files}"
DESTINO_FOTOS="${STORAGE_LOCAL_DIR:-}"

paso() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[0;32m✓\033[0m %s\n" "$*"; }

for v in SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!v:-}" ]]; then
    echo "Falta la variable ${v}. Mira las instrucciones arriba." >&2
    exit 1
  fi
done

# La carpeta de fotos sale del .env de la app, para que no haya dos verdades
# sobre dónde viven los archivos.
if [[ -z "$DESTINO_FOTOS" ]]; then
  ENV_APP="$(find /home/*/htdocs -maxdepth 2 -name .env 2>/dev/null | head -1)"
  if [[ -n "$ENV_APP" ]]; then
    DESTINO_FOTOS="$(grep -E '^STORAGE_LOCAL_DIR=' "$ENV_APP" | cut -d'"' -f2)"
  fi
fi
if [[ -z "$DESTINO_FOTOS" ]]; then
  echo "No sé dónde guardar las fotos. Pasa STORAGE_LOCAL_DIR=..." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
paso "Deteniendo la app"
# Con la app apagada nadie escribe en la base nueva mientras se restaura, y
# nadie registra un cobro en Supabase que luego se quede sin copiar.
systemctl stop inversiones-jcj 2>/dev/null || true
ok "Detenida"

# ---------------------------------------------------------------------------
paso "Copiando la base"
VOLCADO="/tmp/supabase-$(date +%Y%m%d-%H%M%S).dump"
# Formato comprimido: una cartera con años de recibos no cabe cómoda en texto.
# --no-owner y --no-acl porque los roles de Supabase no existen aquí y sin eso
# la restauración se llena de errores de permisos.
pg_dump --format=custom --no-owner --no-acl --schema=public \
  --file="$VOLCADO" "$SUPABASE_DB_URL"
ok "Volcado: $(du -h "$VOLCADO" | cut -f1)"

# La base local ya tiene las tablas creadas por las migraciones. Se vacía y se
# vuelve a crear para que la restauración entre limpia: si no, cada tabla
# choca con la que ya está y quedaría a medias sin avisar del todo.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$BASE" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
chmod 644 "$VOLCADO"
sudo -u postgres pg_restore --no-owner --no-acl --dbname="$BASE" "$VOLCADO"

FILAS=$(sudo -u postgres psql -tAc \
  'SELECT count(*) FROM "Loan"' -d "$BASE" 2>/dev/null || echo 0)
ok "Restaurada — ${FILAS} préstamos"

# El dueño de las tablas restauradas es quien restauró, no la app.
sudo -u postgres psql -d "$BASE" -tAc \
  "SELECT 'ALTER TABLE public.\"' || tablename || '\" OWNER TO jcj;'
   FROM pg_tables WHERE schemaname='public'" \
  | sudo -u postgres psql -d "$BASE" >/dev/null
sudo -u postgres psql -d "$BASE" \
  -c "GRANT ALL ON SCHEMA public TO jcj;" >/dev/null
ok "Tablas puestas a nombre de la app"

# ---------------------------------------------------------------------------
paso "Bajando las fotos"
# Las claves de los archivos son idénticas en los dos proveedores
# —"<empresa>/<uuid>.jpg"— y en la base se guarda "/api/files/<clave>". Por eso
# basta con bajar cada archivo a la misma ruta: no hay que tocar ni un registro.
mkdir -p "$DESTINO_FOTOS"

# La lista sale de la propia base de Supabase, no de su API de listados: ahí
# la columna `name` ya trae la ruta completa dentro del cubo, sin paginar ni
# entrar carpeta por carpeta. Una consulta y ya está.
LISTA="/tmp/fotos-supabase.txt"
psql "$SUPABASE_DB_URL" -tAc \
  "SELECT name FROM storage.objects WHERE bucket_id = '${BUCKET}' ORDER BY name" \
  > "$LISTA"

CUANTOS=$(wc -l < "$LISTA")
ok "${CUANTOS} archivos por bajar"

TOTAL=0
FALLOS=0
while IFS= read -r clave; do
  [[ -z "$clave" ]] && continue
  mkdir -p "${DESTINO_FOTOS}/$(dirname "$clave")"
  if curl -fsS \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${clave}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -o "${DESTINO_FOTOS}/${clave}"
  then
    TOTAL=$((TOTAL + 1))
  else
    FALLOS=$((FALLOS + 1))
    echo "    ! no pude bajar ${clave}" >&2
  fi
done < "$LISTA"

ok "${TOTAL} archivos en ${DESTINO_FOTOS}"
# Una foto que falta no rompe la app —sale el recuadro vacío— pero es un
# documento de identidad que ya no está, y eso hay que saberlo ahora y no el
# día que haga falta.
if [[ "$FALLOS" -gt 0 ]]; then
  echo "    ! ${FALLOS} archivos no bajaron. Revísalos antes de apagar Supabase." >&2
fi

DUENO="$(stat -c '%U' "$(dirname "$DESTINO_FOTOS")")"
chown -R "${DUENO}:${DUENO}" "$DESTINO_FOTOS"

# ---------------------------------------------------------------------------
paso "Levantando la app"
systemctl start inversiones-jcj
sleep 4
if systemctl is-active --quiet inversiones-jcj; then
  ok "Corriendo"
else
  echo "No levantó. Mira: journalctl -u inversiones-jcj -n 50" >&2
  exit 1
fi

rm -f "$LISTA"

printf "\n\033[1;32mDatos traídos.\033[0m\n\n"
cat <<FIN
Antes de dar por buena la mudanza, comprueba en la app:

  - Entra con tu usuario de siempre. Si la contraseña sirve, las sesiones y
    los usuarios llegaron completos.
  - Abre un cliente y mira que se vean sus fotos. Si sale el recuadro vacío,
    el archivo no bajó.
  - Cuadra el total de préstamos con el que veías en Vercel.
  - Registra un cobro de prueba y bórralo.

El volcado quedó en ${VOLCADO}. No lo borres hasta que hayas comprobado todo:
es tu vuelta atrás.
FIN
